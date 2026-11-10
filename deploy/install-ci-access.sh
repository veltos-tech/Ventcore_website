#!/usr/bin/env bash
# Одноразовая настройка сервера для автоматического выпуска из GitHub Actions.
# Запуск от root, из папки с репозиторием на сервере:
#   bash deploy/install-ci-access.sh "ssh-ed25519 AAAA… github-actions-ventcore"
# где аргумент — ПУБЛИЧНЫЙ ключ (приватная часть хранится только в секретах GitHub).
# Скрипт можно запускать повторно: он обновит скрипт выпуска и заменит ключ.
#
# Что получится:
#  • пользователь deploy без пароля, зайти им можно только по этому ключу;
#  • ключ ограничен: ни терминала, ни пробросов портов — только запуск /usr/local/sbin/ventcore-deploy;
#  • sudo разрешает пользователю deploy ровно один запуск: /usr/local/sbin/ventcore-deploy без аргументов;
#  • сам скрипт выпуска принадлежит root и лежит вне папки сайта, поэтому выпускаемый код не может его изменить.
set -Eeuo pipefail
umask 022
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_USER=deploy
APP_USER=ventcore
APP_DIR=/opt/ventcore
ENV_FILE=/etc/ventcore/crm.env
TARGET=/usr/local/sbin/ventcore-deploy
SUDOERS=/etc/sudoers.d/ventcore-deploy

die() { echo "ОШИБКА: $*" >&2; exit 1; }
step() { echo "• $*"; }

[[ $EUID -eq 0 ]] || die "запустите от root (sudo bash $0 \"<публичный ключ>\")"
key=${1:-}
[[ -n $key ]] || die "передайте публичный ключ в кавычках: bash $0 \"ssh-ed25519 AAAA… комментарий\""
# Только ed25519, одна строка, без кавычек и обратных слэшей: ключ вставляется в authorized_keys рядом с командой.
[[ $key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9._@:+=-]+)?$ ]] || die "ожидался один публичный ключ ssh-ed25519 (файл .pub целиком, одной строкой)"

for tool in sudo visudo runuser flock curl git logger; do
  command -v "$tool" >/dev/null || die "не найдена команда $tool"
done
id "$APP_USER" >/dev/null 2>&1 || die "нет пользователя $APP_USER"
[[ -d $APP_DIR/.git ]] || die "$APP_DIR не является клоном репозитория"
[[ -r $ENV_FILE ]] || die "нет файла настроек $ENV_FILE"
[[ -f /etc/systemd/system/ventcore.service ]] || die "не установлен сервис ventcore (deploy/ventcore.service)"
[[ -f $HERE/ventcore-deploy ]] || die "рядом со скриптом нет файла ventcore-deploy"
bash -n "$HERE/ventcore-deploy" || die "в ventcore-deploy синтаксическая ошибка"

step "Пользователь $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --comment "GitHub Actions deploy" "$DEPLOY_USER"
fi
passwd -l "$DEPLOY_USER" >/dev/null   # вход по паролю закрыт

step "Скрипт выпуска → $TARGET"
install -o root -g root -m 0755 "$HERE/ventcore-deploy" "$TARGET"

step "Правило sudo → $SUDOERS"
tmp=$(mktemp)
printf '%s ALL=(root) NOPASSWD: %s ""\n' "$DEPLOY_USER" "$TARGET" >"$tmp"
visudo -cf "$tmp" >/dev/null || { rm -f "$tmp"; die "правило sudo не прошло проверку"; }
install -o root -g root -m 0440 "$tmp" "$SUDOERS"
rm -f "$tmp"

step "SSH-ключ с ограничениями"
home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$home/.ssh"
printf 'restrict,command="sudo %s" %s\n' "$TARGET" "$key" >"$home/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$home/.ssh/authorized_keys"
chmod 600 "$home/.ssh/authorized_keys"

echo
echo "Проверка:"
sudo -l -U "$DEPLOY_USER" | sed 's/^/  /'
if command -v sshd >/dev/null && settings=$(sshd -T 2>/dev/null); then
  grep -qi '^pubkeyauthentication yes' <<<"$settings" || echo "  ВНИМАНИЕ: в sshd отключён вход по ключам (PubkeyAuthentication)."
  if grep -qi '^allowusers' <<<"$settings" && ! grep -i '^allowusers' <<<"$settings" | grep -qw "$DEPLOY_USER"; then
    echo "  ВНИМАНИЕ: в sshd задан AllowUsers без $DEPLOY_USER — добавьте его, иначе GitHub не сможет зайти."
  fi
fi

host_pub=/etc/ssh/ssh_host_ed25519_key.pub
if [[ -r $host_pub ]]; then
  echo
  echo "Отпечаток ключа сервера (сверьте с тем, что увидите в GitHub-секрете DEPLOY_KNOWN_HOSTS):"
  ssh-keygen -lf "$host_pub" | sed 's/^/  /'
  echo
  echo "Значение секрета DEPLOY_KNOWN_HOSTS (замените ВАШ_ХОСТ на тот же адрес, что в секрете DEPLOY_HOST):"
  echo "  ВАШ_ХОСТ $(cut -d' ' -f1,2 "$host_pub")"
fi

echo
echo "Готово. Первый выпуск пройдёт, когда в GitHub появятся секреты (см. README, раздел «Автоматический выпуск»)."
