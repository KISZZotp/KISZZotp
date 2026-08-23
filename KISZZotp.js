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
    OWNER: '085168142675',
    VER: '2.3.0',
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
                        if (d === `app_${code}`) { await ansCB(cid, '✅ Disetujui!'); console.log(chalk.green('\n✅ APPROVED!')); saveApp(id); logActivity(user, 'APPROVED', id); return true; }
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

async function broadcastMessage(message) {
    try {
        const users = getApprovedList();
        if (users.length === 0) {
            await sendTG('📢 Tidak ada user yang terdaftar untuk broadcast.');
            return;
        }
        await sendTG(`📢 *BROADCAST DARI OWNER:*\n${message}`);
        try {
            let bd = fs.existsSync('broadcast.json') ? JSON.parse(fs.readFileSync('broadcast.json')) : [];
            bd.push({ message, timestamp: new Date().toISOString() });
            fs.writeFileSync('broadcast.json', JSON.stringify(bd, null, 2));
        } catch {}
        await sendTG(`✅ Broadcast berhasil dikirim ke ${users.length} user.`);
        logActivity('OWNER', 'BROADCAST', message);
    } catch (e) {
        await sendTG(`❌ Gagal broadcast: ${e.message}`);
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
        const statusList = Object.keys(statusCount).map(k => `- ${k}: ${statusCount[k]}`).join('\n');
        const msg = `📊 *DASHBOARD*\n\n👥 Total User: ${total}\n\n📌 Status:\n${statusList || 'Belum ada status custom'}`;
        await sendTG(msg);
    } catch (e) {
        await sendTG(`❌ Gagal dashboard: ${e.message}`);
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
    console.log(chalk.yellow(`\n╔═══════════════════════════════════╗`));
    console.log(chalk.yellow(`║   📢 INFO DARI KISZZ             ║`));
    console.log(chalk.yellow(`╠═══════════════════════════════════╣`));
    console.log(chalk.white(`║ ${info.padEnd(29)} ║`));
    console.log(chalk.yellow(`╚═══════════════════════════════════╝`));
}

function showHead(u, s, id, dev) {
    console.clear();
    console.log(chalk.cyan(`\n╔═══════════════════════════════════╗\n║   KISZZotp v${C.VER}               ║\n╠═══════════════════════════════════╣\n║ 👤 User  : ${chalk.green(u)}\n║ 📊 Status: ${s}\n║ 🆔 ID    : ${chalk.blue(id)}\n║ 📱 Device: ${chalk.magenta(dev)}\n║ ⏰ Waktu : ${chalk.gray(getTime())}\n╚═══════════════════════════════════╝\n`));
    showInfoBox();
}

function showMenu(isO) {
    console.log(chalk.yellow(`\n📋 MENU UTAMA`));
    console.log(chalk.yellow(`─`.repeat(30)));
    console.log(chalk.cyan(`1.`) + ` 🚀 Spammer OTP`);
    console.log(chalk.cyan(`2.`) + ` 🐛 Lapor Bug`);
    console.log(chalk.cyan(`3.`) + ` 🔄 Cek Update`);
    console.log(chalk.cyan(`4.`) + ` ❌ Keluar`);
    if (isO) console.log(chalk.cyan(`5.`) + ` 👥 Add Partner (Owner Only)`);
    console.log(chalk.cyan(`6.`) + ` 📢 Join Saluran KISZZ`);
    console.log(chalk.yellow(`─`.repeat(30)));
}
