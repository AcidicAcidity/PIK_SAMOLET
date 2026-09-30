#!/usr/bin/env bash
# Двойной клик в Finder запускает проект в Терминале
cd "$(dirname "$0")" && ./start.sh
echo; read -n 1 -s -r -p "Нажмите любую клавишу, чтобы закрыть окно…"
