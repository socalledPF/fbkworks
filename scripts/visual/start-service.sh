#!/usr/bin/env bash
# 启动一个 dev server，并证明「就绪的是我刚起的那个进程」。
#
# 为什么不用「curl 固定端口」：应用没有 strictPort，端口被占用时 vite 会**静默换端口**，
# 于是 curl 命中的可能是上一次残留的实例 —— 探测通过、评的却不是这次启动的服务。
#
# 用法：
#   source scripts/visual/start-service.sh
#   start_service playground /tmp/pg.log && echo "端口 $FBK_PORT pid $FBK_PID"
#
# 成功时设置 FBK_PID / FBK_PORT；失败返回 1 并打印日志尾部。
start_service() {
  local script="$1" log="$2"
  # 关掉颜色：vite 会把端口号包在 ANSI 转义里（实测 "localhost:^[[1m5174^[[22m/"），
  # 直接 grep 端口会匹配不到 —— 这一步是「等就绪」能否成立的前提。
  NO_COLOR=1 FORCE_COLOR=0 pnpm "$script" > "$log" 2>&1 &
  local pid=$!
  # 240 秒：CI 上的冷启动实测要 120 秒上下（pnpm 解析 + vite 首次预打包），
  # 窗口卡在 120 秒会以「差一秒」的形式随机失败。
  local i port
  for i in $(seq 1 240); do
    if [ $((i % 15)) -eq 0 ]; then
      echo "[start-service] 等待 $script 报出端口……（${i}s，pid $pid）"
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "::error::$script 启动后立刻退出（pid $pid）" >&2
      tail -n 40 "$log" >&2
      return 1
    fi
    # vite 就绪时会打印 Local: http://localhost:<port>/ —— 以它为准，而不是默认端口
    # 再剥一次转义作为兜底：任何一层没遵守 NO_COLOR 时仍然能取到端口
    port=$(sed -E 's/\x1B\[[0-9;]*[mK]//g' "$log" 2>/dev/null | grep -oE 'http://localhost:[0-9]+/' | head -1 | grep -oE '[0-9]+' || true)
    if [ -n "$port" ]; then
      FBK_PID="$pid"
      FBK_PORT="$port"
      echo "[start-service] $script 就绪：端口 $port（pid $pid）"
      return 0
    fi
    sleep 1
  done
  echo "::error::$script 在 240s 内没有报出监听端口" >&2
  tail -n 40 "$log" >&2
  return 1
}
