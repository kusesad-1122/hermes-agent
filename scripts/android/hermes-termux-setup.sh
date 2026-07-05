#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# Hermes Agent — 安卓 (Termux) 一键安装脚本  /  one-tap Android setup
# =============================================================================
#
# 这个脚本在手机的 Termux 里把 Hermes 的"大脑"(Python 后端)装好。
# 装完后用同目录的 hermes-termux-run.sh 启动,再用手机浏览器打开
#   http://127.0.0.1:9119
# 即可开始对话,并"添加到主屏幕"变成一个 App(PWA)。
#
# 用法(在 Termux 里):
#   bash hermes-termux-setup.sh
#
# 需要:一部安卓手机 + 从 F-Droid 安装的 Termux(不要用 Google Play 版,已过时)。
# 建议同时从 F-Droid 安装 "Termux:API" 以支持后台保活 (termux-wake-lock)。
# =============================================================================
set -euo pipefail

say()  { printf '\033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- 0. 确认是在 Termux 里跑 -------------------------------------------------
if [ -z "${TERMUX_VERSION:-}" ] && [[ "${PREFIX:-}" != *"com.termux/files/usr"* ]]; then
    die "这个脚本必须在安卓的 Termux 里运行。请先从 F-Droid 安装 Termux,打开它,再跑本脚本。"
fi
ok "检测到 Termux 环境"

# --- 1. 安装系统依赖 ---------------------------------------------------------
say "更新 Termux 软件源并安装依赖(第一次会下载几十~上百 MB,请耐心)..."
pkg update -y || warn "pkg update 有告警,继续尝试安装"
# python/git 必需;rust/binutils/clang/make 用于编译部分带原生扩展的依赖;
# ripgrep 是 Hermes 的搜索工具;openssl/libjpeg 常见传递依赖;
# termux-api 提供 termux-wake-lock 用于后台保活。
pkg install -y python git rust binutils clang make ripgrep openssl libjpeg-turbo termux-api \
    || die "依赖安装失败,请检查网络后重试"
ok "系统依赖安装完成"

# --- 2. 授予存储权限(读手机文件的关键一步)---------------------------------
say "申请存储访问权限 —— 稍后手机会弹窗,请点【允许】。"
say "这一步让 Hermes 能读到你手机 /sdcard 里的照片、下载、文档等文件。"
termux-setup-storage || warn "termux-setup-storage 未完成(可稍后手动重跑);不影响后端启动。"
ok "存储权限步骤已触发(如未弹窗,手机设置里给 Termux 开启存储权限即可)"

# --- 3. 安装 Hermes 本体 -----------------------------------------------------
if command -v hermes >/dev/null 2>&1; then
    ok "已检测到已安装的 hermes,跳过安装(如需更新可跑 hermes update)"
else
    say "开始安装 Hermes Agent(官方安装器,已适配 Termux)..."
    # 官方安装器会在 Termux 上自动选用 .[termux] 精简依赖 + constraints-termux.txt
    export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk 2>/dev/null || printf '%s' "${ANDROID_API_LEVEL:-}")"
    curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash \
        || die "安装失败。可改用手动方式:见 docs/android/使用指南.zh-CN.md 的《手动安装》一节。"
    # 让本次会话能立刻找到 hermes 命令
    # shellcheck disable=SC1090
    [ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc" || true
    ok "Hermes 安装完成"
fi

# --- 4. 收尾提示 -------------------------------------------------------------
cat <<'EOF'

──────────────────────────────────────────────────────────────
✅ 安装完成!接下来 3 步就能在手机上用起来:

1) 选一个模型 / 填 API Key(照提示走一次即可):
     hermes setup
   (没有自己的 Key?可以用 Nous Portal 一站式:hermes setup --portal)

2) 启动"大脑" + 保活:
     bash scripts/android/hermes-termux-run.sh

3) 用手机浏览器(Chrome)打开:
     http://127.0.0.1:9119
   右上角菜单 →【添加到主屏幕 / 安装应用】,桌面就会出现 Hermes 图标,
   点开就是一个独立 App 窗口 🎉

想读手机文件?在对话里直接说,例如:
   "列一下 /sdcard/Download 里的文件" 或 "读一下 /sdcard/xxx.txt"
──────────────────────────────────────────────────────────────
EOF
