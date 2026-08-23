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
    VERSION: '1.6.0',
    APPROVAL_TIMEOUT: 120,
    POLL_INTERVAL: 1,
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// UTILITY
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
// STATUS CUSTOM
// ============================================
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

// ============================================
// TELEGRAM
// ============================================
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

// ============================================
// APPROVAL SYSTEM
// ============================================
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

                // === COMMAND OWNER ===
                if (update.message && update.message.text) {
                    const text = update.message.text;
                    const fromId = update.message.from.id;
                    if (fromId == CONFIG.TELEGRAM_CHAT_ID) {
                        // /addpartner
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

                        // /removepartner
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

                        // /listpartner
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

                        // /block
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

                        // /unblock
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

                        // /listblocked
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

                        // ========== FITUR SETSTATUS ==========
                        // /setstatus <termuxId> <status>
                        if (text.startsWith('/setstatus')) {
                            const parts = text.split(' ');
                            if (parts.length < 3) {
                                await sendTelegramMessage('❌ Format: /setstatus <termuxId> <status>\nContoh: /setstatus 10058@localhost Gembel');
                                continue;
                            }
                            const targetId = parts[1].trim();
                            const status = parts.slice(2).join(' ');
                            if (setUserStatus(targetId, status)) {
                                await sendTelegramMessage(`✅ Status *${targetId}* diubah menjadi: *${status}*`);
                            } else {
                                await sendTelegramMessage(`❌ Gagal mengubah status ${targetId}.`);
                            }
                        }

                        // /getstatus <termuxId>
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
                                await sendTelegramMessage(`📌 Status *${targetId}*: (default) Gratisan`);
                            }
                        }

                        // /liststatus
                        if (text.startsWith('/liststatus')) {
                            const all = getAllStatus();
                            const keys = Object.keys(all);
                            if (keys.length === 0) {
                                await sendTelegramMessage('📋 Belum ada status custom.');
                            } else {
                                const list = keys.map(id => `- ${id}: ${all[id]}`).join('\n');
                                await sendTelegramMessage(`📋 *Daftar Status Custom*\n${list}`);
                            }
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

// ============================================
// MENU & TAMPILAN
// ============================================
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

function showMenu(isOwner) {
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

// ============================================
// HALAMAN SPAMMER
// ============================================
async function halamanSpammer(user, termuxId) {
    console.clear();
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║         🚀  HALAMAN SPAMMER OTP              ║
╚═══════════════════════════════════════════════╝
`));

    const target = readlineSync.question(chalk.white('📱 Masukkan nomor target (contoh: 08123456789): '));
   
