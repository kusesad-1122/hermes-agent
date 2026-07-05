#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# Hermes Agent — 安卓 (Termux) 启动 + 后台保活  /  run + keep-alive
# =============================================================================
#
# 启动 Hermes 的"大脑"(本机 dashboard 后端),并尽量让它在后台不被安卓杀掉:
#   • termux-wake-lock : 拿唤醒锁,阻止 CPU 休眠(需要 F-Droid 的 Termux:API)
#   • root 白名单      : 把 Termux 加入省电 (Doze) 白名单(检测到 root 时才做)
#   • 看门狗           : 后端意外退出时自动重启
#
# 启动后用手机浏览器打开 http://127.0.0.1:9119
#
# 用法(在 Termux 里,已 hermes setup 过之后):
#   bash scripts/android/hermes-termux-run.sh
#   bash scripts/android/hermes-termux-run.sh --port 9119   # 自定义端口
#
# 停止:在本窗口按 Ctrl+C。
# =============================================================================
set -uo pipefail

HOST="127.0.0.1"
PORT="9119"
while [ $# -gt 0 ]; do
    case "$1" in
        --port) PORT="${2:?--port 需要一个端口号}"; shift 2 ;;
        --host) HOST="${2:?--host 需要一个地址}"; shift 2 ;;
        *) printf '未知参数: %s\n' "$1" >&2; exit 2 ;;
    esac
done

say()  { printf '\033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }

command -v hermes >/dev/null 2>&1 || {
    printf '\033[31m✗ 找不到 hermes 命令。请先运行 scripts/android/hermes-termux-setup.sh 安装。\033[0m\n' >&2
    exit 1
}

# --- 唤醒锁:阻止休眠 --------------------------------------------------------
WAKELOCK=0
if command -v termux-wake-lock >/dev/null 2>&1; then
    if termux-wake-lock 2>/dev/null; then
        WAKELOCK=1
        ok "已获取唤醒锁 (termux-wake-lock)"
    else
        warn "termux-wake-lock 调用失败(是否已安装 Termux:API 应用?)"
    fi
else
    warn "未安装 termux-api,跳过唤醒锁。建议从 F-Droid 装 'Termux:API' 以提升后台存活率。"
fi

# --- root:加入 Doze 省电白名单 ---------------------------------------------
# 你说你有 root。检测到可用的 su 时,把 Termux 加进省电白名单,能显著降低
# 系统在锁屏后杀掉后端的概率。失败也不影响运行(只是没那么"耐杀")。
if command -v su >/dev/null 2>&1 && echo "id" | su 2>/dev/null | grep -q "uid=0"; then
    say "检测到 root,尝试把 Termux 加入省电 (Doze) 白名单..."
    su -c 'dumpsys deviceidle whitelist +com.termux' >/dev/null 2>&1 \
        && ok "已加入 Doze 白名单" \
        || warn "加入白名单失败(不同 ROM 命令略有差异,可忽略)"
else
    warn "未检测到可用 root(或未授权)。跳过 Doze 白名单;唤醒锁仍在生效。"
fi

# --- 退出时清理 --------------------------------------------------------------
RUNNING=1
cleanup() {
    RUNNING=0
    printf '\n'
    say "正在停止 Hermes 后端..."
    [ "$WAKELOCK" = "1" ] && termux-wake-unlock 2>/dev/null && ok "已释放唤醒锁" || true
    exit 0
}
trap cleanup INT TERM

# --- 看门狗:启动 + 崩溃自动重启 --------------------------------------------
cat <<EOF

──────────────────────────────────────────────────────────────
🚀 正在启动 Hermes 大脑:  http://${HOST}:${PORT}
   • 手机浏览器打开上面的地址即可对话
   • 浏览器菜单 →【添加到主屏幕 / 安装应用】= 变成 App
   • 想停止:在本窗口按 Ctrl+C
──────────────────────────────────────────────────────────────
EOF

while [ "$RUNNING" = "1" ]; do
    # --no-open: Termux 没有桌面浏览器可开;loopback 绑定使用简单 token 鉴权。
    hermes dashboard --host "$HOST" --port "$PORT" --no-open || true
    [ "$RUNNING" = "1" ] || break
    warn "后端退出了,3 秒后自动重启(按 Ctrl+C 可彻底停止)..."
    sleep 3
done
