#!/bin/bash
echo "🚀 KISZZotp Installer"
echo "======================"
echo "📦 Mengupdate package..."
pkg update -y && pkg upgrade -y
echo "📦 Menginstall Node.js..."
pkg install nodejs-lts git -y
echo "📦 Menginstall dependencies..."
npm install axios chalk readline-sync
echo "✅ Selesai!"
echo ""
echo "📱 Jalankan: node KISZZotp.js"