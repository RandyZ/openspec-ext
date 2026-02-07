#!/bin/bash

# 测试脚本：启动 VSCode Extension Development Host

echo "🧪 Testing OpenSpec VSCode Extension..."
echo ""

# 1. 构建扩展
echo "📦 Building extension..."
pnpm run compile

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# 2. 检查输出文件
echo "📁 Checking build output..."
if [ -f "dist/extension.js" ]; then
    echo "✅ dist/extension.js exists ($(stat -f%z dist/extension.js) bytes)"
else
    echo "❌ dist/extension.js not found!"
    exit 1
fi

echo ""
echo "🚀 Ready to test!"
echo ""
echo "To test the extension:"
echo "1. Press F5 in VSCode"
echo "2. Or run: code --extensionDevelopmentPath=$(pwd)"
echo ""
echo "Then check the Console for: 'OpenSpec extension is now active!'"
