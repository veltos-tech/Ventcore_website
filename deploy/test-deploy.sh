#!/usr/bin/env bash
# Проверка логики deploy/ventcore-deploy без сервера: настоящие git-репозитории во временной папке,
# а systemctl, npm, сборка и запросы к сайту заменены заглушками.
# Запуск: bash deploy/test-deploy.sh  (выполняется в CI перед каждым выпуском).
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT="$HERE/ventcore-deploy"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

failures=0
check() { # check "описание" команда...
  local what=$1
  shift
  if "$@"; then echo "  ok   $what"; else echo "  FAIL $what"; failures=$((failures + 1)); fi
}
has_line() { grep -qx -- "$1" "$2"; }
no_line() { ! grep -qx -- "$1" "$2"; }

# Создаёт origin и «сервер» (клон на коммите A). Если $1 = legacy, в A закоммичен node_modules,
# как было в первом репозитории проекта.
# Результат: $ORIGIN, $APP, $A (прежний коммит), $B (новый коммит в main).
setup() {
  local mode=$1
  rm -rf "$WORK/case"
  mkdir -p "$WORK/case" && cd "$WORK/case" || exit 1
  git init -q --bare -b main origin.git
  git clone -q origin.git seed 2>/dev/null
  (
    cd seed || exit 1
    echo v1 >app.txt
    if [[ $mode == legacy ]]; then
      mkdir node_modules && echo legacy >node_modules/old.txt
    else
      printf '/node_modules\n/.next\n/node_modules.prev\n/.next.prev\n' >.gitignore
    fi
    git add -A && git commit -q -m A && git push -q origin HEAD:main
    git rev-parse HEAD >../A
    echo v2 >app.txt
    if [[ $mode == legacy ]]; then git rm -r -q --cached node_modules && printf '/node_modules\n' >.gitignore && git add .gitignore; fi
    git commit -q -am B && git push -q origin HEAD:main
    git rev-parse HEAD >../B
    git checkout -q -b feature && echo x >feature.txt && git add -A && git commit -q -m C && git push -q origin feature
    git rev-parse HEAD >../C
  )
  git clone -q origin.git app 2>/dev/null
  (cd app && git reset -q --hard "$(cat ../A)")
  mkdir -p app/.next && echo old-build >app/.next/BUILD
  if [[ $mode != legacy ]]; then mkdir -p app/node_modules && echo old >app/node_modules/old.txt; fi
  APP="$WORK/case/app" A=$(cat A) B=$(cat B) C=$(cat C)
  : >"$WORK/case/calls"
}

# Запускает deploy() в подоболочке с заглушками. Переменные окружения FAIL_* задают, где «сломаться».
run_deploy() {
  local target=$1
  (
    # shellcheck source=/dev/null
    source "$SCRIPT"
    APP_DIR=$APP APP_USER=$(id -un) APP_HOME="$WORK/case/home" ENV_FILE=/dev/null
    TARGET=$target
    as_app() { "$@"; }
    logger() { :; }
    sleep() { :; }
    backup_db() { echo backup >>"$WORK/case/calls"; [[ -z ${FAIL_BACKUP:-} ]]; }
    install_deps() { rm -rf "$APP_DIR/node_modules" && mkdir -p "$APP_DIR/node_modules" && echo new >"$APP_DIR/node_modules/new.txt"; }
    build_app() { [[ -z ${FAIL_BUILD:-} ]] || return 1; mkdir -p "$APP_DIR/.next" && echo new-build >"$APP_DIR/.next/BUILD"; }
    sync_bot() { echo sync >>"$WORK/case/calls"; [[ -z ${FAIL_SYNC:-} ]]; }
    health_check() { [[ -z ${FAIL_HEALTH:-} || -f $WORK/case/rolled-back ]]; }
    # Откат считается выполненным, когда сайт запущен второй раз.
    systemctl() {
      echo "systemctl $*" >>"$WORK/case/calls"
      [[ $1 == start && $(grep -c '^systemctl start' "$WORK/case/calls") -ge 2 ]] && touch "$WORK/case/rolled-back"
      return 0
    }
    deploy
  ) >"$WORK/case/out" 2>&1
}
head_of_app() { git -C "$APP" rev-parse HEAD; }

echo "1. Успешный выпуск (в репозитории закоммичен node_modules, как в первой версии)"
setup legacy
run_deploy "$B"
check "код обновлён до B" test "$(head_of_app)" = "$B"
check "зависимости новые" test "$(cat "$APP/node_modules/new.txt" 2>/dev/null)" = new
check "старых зависимостей нет" test ! -e "$APP/node_modules/old.txt"
check "сборка новая" test "$(cat "$APP/.next/BUILD")" = new-build
check "временные каталоги убраны" test ! -e "$APP/node_modules.prev" -a ! -e "$APP/.next.prev"
check "порядок: копия → остановка → запуск → настройка бота" bash -c "tr '\n' ' ' <'$WORK/case/calls' | grep -q '^backup systemctl stop ventcore systemctl start ventcore sync $'"

echo "1б. Сбой настройки бота не отменяет выпуск"
setup modern
FAIL_SYNC=1 run_deploy "$B"
check "код обновлён до B" test "$(head_of_app)" = "$B"
check "предупреждение выведено" grep -q 'не удалось обновить настройки бота' "$WORK/case/out"
check "прежняя версия не возвращалась" test "$(grep -c '^systemctl start' "$WORK/case/calls")" = 1

echo "2. Ошибка сборки — откат на прежнюю версию (legacy)"
setup legacy
FAIL_BUILD=1 run_deploy "$B"
check "выпуск завершился ошибкой" test $? -ne 0
check "код вернулся на A" test "$(head_of_app)" = "$A"
check "прежний node_modules восстановлен" test "$(cat "$APP/node_modules/old.txt" 2>/dev/null)" = legacy
check "новых зависимостей нет" test ! -e "$APP/node_modules/new.txt"
check "прежняя сборка восстановлена" test "$(cat "$APP/.next/BUILD")" = old-build
check "сайт запущен снова" has_line "systemctl start ventcore" "$WORK/case/calls"

echo "3. Ошибка сборки — откат (обычный репозиторий без node_modules в git)"
setup modern
FAIL_BUILD=1 run_deploy "$B"
check "код вернулся на A" test "$(head_of_app)" = "$A"
check "прежний node_modules восстановлен" test "$(cat "$APP/node_modules/old.txt" 2>/dev/null)" = old
check "прежняя сборка восстановлена" test "$(cat "$APP/.next/BUILD")" = old-build
check "сайт запущен снова" has_line "systemctl start ventcore" "$WORK/case/calls"

echo "4. Сайт не отвечает после запуска — откат"
setup modern
FAIL_HEALTH=1 run_deploy "$B"
check "код вернулся на A" test "$(head_of_app)" = "$A"
check "прежняя сборка восстановлена" test "$(cat "$APP/.next/BUILD")" = old-build
check "сайт запускался дважды (новая и прежняя версия)" test "$(grep -c '^systemctl start' "$WORK/case/calls")" = 2

echo "5. Коммит не из main отклоняется до остановки сайта"
setup modern
run_deploy "$C"
check "выпуск отклонён" test $? -ne 0
check "код не менялся" test "$(head_of_app)" = "$A"
check "сайт не останавливали" no_line "systemctl stop ventcore" "$WORK/case/calls"
check "причина названа" grep -q 'не входит в ветку main' "$WORK/case/out"

echo "6. Несуществующий коммит отклоняется"
setup modern
run_deploy "0000000000000000000000000000000000000000"
check "выпуск отклонён" test $? -ne 0
check "сайт не останавливали" no_line "systemctl stop ventcore" "$WORK/case/calls"

echo "7. Не удалась копия базы — выпуск отменяется, сайт не трогаем"
setup modern
FAIL_BACKUP=1 run_deploy "$B"
check "выпуск отклонён" test $? -ne 0
check "код не менялся" test "$(head_of_app)" = "$A"
check "сайт не останавливали" no_line "systemctl stop ventcore" "$WORK/case/calls"

echo "8. Неверный ввод на stdin"
for input in "" "main" "abc" "$(printf 'a%.0s' {1..39})" "$(printf 'g%.0s' {1..40})" "$(printf 'a%.0s' {1..40}); id"; do
  printf '%s\n' "$input" | bash "$SCRIPT" >"$WORK/out" 2>&1
  check "отклонён ввод «${input:0:20}»" test $? -ne 0
done

echo
if ((failures)); then
  echo "Не пройдено проверок: $failures"
  exit 1
fi
echo "Скрипт выпуска: все проверки пройдены."
