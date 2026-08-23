#!/bin/bash
echo "🚀 KISZZotp Installer"
pkg update -y && pkg upgrade -y
pkg install nodejs-lts -y
npm install
echo "✅ Selesai! Jalankan: node KISZZotp.js"