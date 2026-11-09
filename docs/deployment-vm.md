# Развёртывание Hockey OS рядом с «Лигой двора» и sport-cheb

Инструкция подготовлена 9 ноября 2026 года для Linux-ВМ с уже установленными Docker Engine, Docker Compose и Nginx на хосте. В локальных production-конфигурациях `league-os` и `sportcheb` используются отдельные Compose-проекты. Их стандартные HTTP-порты — 8081 и 8080 соответственно; реальные значения на сервере могут отличаться.

Для хоккея подготовлены `Dockerfile`, `compose.production.yml`, шаблон Nginx и вспомогательные скрипты. Команды ниже выполняются вручную; к виртуальной машине при подготовке этой инструкции подключение не выполнялось. Локально проверены синтаксис Bash и разбор Compose. Полная сборка и запуск Linux-контейнеров на этой ВМ ещё не проверены.

## Схема

| Компонент | Настройка хоккейного приложения |
|---|---|
| Каталог на ВМ | `~/hockey-os` |
| Compose-проект | `hockey-os-prod` |
| HTTP на хосте | `127.0.0.1:8082` |
| HTTP внутри контейнера | `4100` |
| PostgreSQL | собственный контейнер, без публикации порта на хост |
| Данные | том `hockey-os-prod_postgres_data` |
| Настройки | `~/hockey-os/.env.production` |
| Основной домен | `chhl.ru`, адрес приложения — `https://chhl.ru` |

Запрос проходит через существующий Nginx: `HTTPS → 127.0.0.1:8082 → Angular + NestJS → PostgreSQL`. Интерфейс и `/api` обслуживаются одним приложением. Node.js и pnpm устанавливаются внутри образа, на хосте они не требуются.

Отдельное имя Compose разделяет контейнеры, сети и тома разных приложений. Скрипт `production.sh` всегда передаёт `-p hockey-os-prod` и явный путь к production-файлу. Основание: [документация Docker о Compose-проектах](https://docs.docker.com/compose/how-tos/project-name/).

## 1. Проверить виртуальную машину

Подключитесь существующим SSH-пользователем:

```bash
ssh USER@VM_IP
docker compose version
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
sudo ss -ltnp '( sport = :8082 )'
systemctl is-active nginx
sudo nginx -t
free -h
df -h
```

Порт 8082 должен быть свободен. Если он занят, выберите свободный и затем укажите его в `APP_BIND_PORT` и `proxy_pass` Nginx. Для сборки Angular нужны свободные память и диск: проверьте их до запуска сборки рядом с двумя работающими приложениями.

Эта инструкция предполагает, что Nginx работает как системная служба на хосте. Если порты 80/443 обслуживает контейнерный Nginx, Traefik или Caddy, используйте его существующий механизм добавления домена; шаблон для `/etc/nginx/sites-available` к такой схеме напрямую не подходит. Из контейнера `127.0.0.1` указывает на сам контейнер.

## 2. Передать исходники

Готовый архив находится на вашем компьютере в папке проекта: `tmp/hockey-os-source.tar.gz`. Он содержит исходный код и конфигурацию развёртывания; зависимости, локальная база и реальные `.env` в него не входят. Рядом находится файл контрольной суммы `tmp/hockey-os-source.sha256`.

В PowerShell на компьютере:

```powershell
Set-Location 'C:\Users\Dimitriy\Documents\ChatGPT\хоккейное приложение'
$server = 'USER@VM_IP'
scp .\tmp\hockey-os-source.tar.gz .\tmp\hockey-os-source.sha256 "${server}:~/"
```

На ВМ при первой установке:

```bash
cd ~
sha256sum -c hockey-os-source.sha256
mkdir -p ~/hockey-os
tar -xzf ~/hockey-os-source.tar.gz -C ~/hockey-os
cd ~/hockey-os
```

Для первой установки каталог должен быть новым. Если приложение там уже развёрнуто, переходите к разделу обновления. Каталоги `~/league-os` и sport-cheb в этих командах не используются.

## 3. Создать настройки и пароли

Создайте отдельные настройки для согласованного домена `chhl.ru`:

```bash
cd ~/hockey-os
hockey_domain='chhl.ru'
bash scripts/create-production-env.sh "https://$hockey_domain"
```

Скрипт создаёт `.env.production` с правами `600`, случайными паролями базы и администратора и отдельным ключом JWT. Существующий файл он не перезаписывает. Если файл уже есть, проверьте его редактором:

```bash
nano .env.production
```

Основные переменные:

```dotenv
POSTGRES_USER=hockey
POSTGRES_PASSWORD=<случайный hex-пароль>
POSTGRES_DB=hockey_os
JWT_SECRET=<отдельный случайный ключ>
INITIAL_ADMIN_PASSWORD=<отдельный пароль администратора>
FRONTEND_ORIGIN=https://chhl.ru
APP_BIND_PORT=8082
HOCKEY_IMAGE_TAG=first
```

`FRONTEND_ORIGIN` должен точно совпадать с HTTPS-адресом в браузере, без завершающего `/`. Иначе сервер отклонит вход и другие POST/PATCH-запросы. Hex-пароль базы, создаваемый скриптом, подходит для включения в URL подключения без дополнительного кодирования. Пароли с `@`, `:`, `/`, `%` потребовали бы кодирования.

Production-конфигурация задаёт `NODE_ENV=production` и `DEMO_SEED=false`. На новой базе автоматически создаются сообщество, сезон 2026/2027 и единственный суперпользователь `admin`. Команды, турниры и демонстрационные протоколы не создаются. Локальная демо-база с компьютера автоматически не переносится.

`INITIAL_ADMIN_PASSWORD` передаётся существующему механизму первой установки через переменную `DEMO_PASSWORD`; это историческое имя переменной. Пароль применяется только на пустой базе. Изменение `.env.production` после установки не меняет пароль пользователя и не меняет пароль уже созданной PostgreSQL.

## 4. Собрать и запустить

```bash
cd ~/hockey-os
bash scripts/production.sh config --quiet
bash scripts/production.sh build app
bash scripts/production.sh up -d --wait --wait-timeout 180
bash scripts/production.sh ps
curl --fail --show-error http://127.0.0.1:8082/api/health
curl --fail --show-error -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8082/tournaments
```

Ожидаются два контейнера в состоянии `healthy`, ответ `{"status":"ok","application":"hockey-os"}` и HTTP 200 для страницы турниров. Если `up` завершился ошибкой, сначала изучите журнал:

```bash
bash scripts/production.sh logs --tail=150 database app
```

Миграции выполняются самим NestJS при запуске; отдельная команда миграции для этой версии не требуется. Том PostgreSQL сохраняется при пересоздании контейнеров. Наружу публикуется только loopback-порт приложения; база доступна приложению в своей Docker-сети. Healthcheck и ожидание готовности описаны в [спецификации сервисов Compose](https://docs.docker.com/reference/compose-file/services/).

Не используйте локальный `docker-compose.yml` для этого развёртывания: он предназначен для разработки. Все серверные команды здесь выполняются через `bash scripts/production.sh`.

## 5. Подключить домен и Nginx

В DNS создайте A-запись корневого домена `chhl.ru` (имя записи `@`) на публичный IPv4 этой ВМ. Если добавляете AAAA, она также должна указывать на рабочий IPv6 этой ВМ. Порты 80/443 должны быть доступны через существующие настройки ВМ и сети; 8082 и PostgreSQL открывать наружу не требуется. Написание `CHHL.ru` эквивалентно `chhl.ru`; в конфигурации используется нижний регистр. Основной адрес — `https://chhl.ru`, обращения по HTTP перенаправляются на HTTPS после настройки сертификата.

На ВМ отредактируйте только новый шаблон:

```bash
cd ~/hockey-os
nano infrastructure/nginx/hockey.conf
```

Проверьте две строки:

```nginx
server_name chhl.ru;
proxy_pass http://127.0.0.1:8082;
```

`proxy_pass` указан без добавления `/api`: сервер получает исходный URI, включая `/api`. Это соответствует [правилам proxy_pass Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

Сохраните копию конфигурации Nginx и добавьте новый виртуальный хост:

```bash
sudo cp -a /etc/nginx "/etc/nginx.before-hockey-$(date +%Y%m%d-%H%M%S)"
sudo cp infrastructure/nginx/hockey.conf /etc/nginx/sites-available/hockey-os
sudo ln -s /etc/nginx/sites-available/hockey-os /etc/nginx/sites-enabled/hockey-os
sudo nginx -t && sudo systemctl reload nginx
```

Команды `cp` и `ln` выше предназначены для первого добавления сайта. Если файл `hockey-os` уже существует, сначала проверьте его содержимое; не заменяйте конфигурацию существующего сайта вслепую.

Шаблон конфигурации:

```nginx
server {
    listen 80;
    server_name chhl.ru;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}
```

## 6. Включить HTTPS

Если для двух существующих сайтов уже используется Certbot, используйте тот же установленный экземпляр:

```bash
hockey_domain='chhl.ru'
certbot --version
sudo certbot --nginx -d "$hockey_domain" --redirect
sudo nginx -t
curl --fail --show-error "https://$hockey_domain/api/health"
```

Certbot добавит HTTPS-конфигурацию и перенаправление HTTP на HTTPS. Если Certbot отсутствует или сертификаты управляются другим инструментом, примените существующую на ВМ схему выдачи сертификатов; инструкция Certbot для Nginx находится [на официальном сайте](https://certbot.eff.org/instructions?ws=nginx&os=snap).

Проверьте продление нового сертификата, указав его фактическое имя из `sudo certbot certificates`:

```bash
sudo certbot certificates
sudo certbot renew --dry-run --cert-name chhl.ru
```

В production сессионная cookie имеет флаг `Secure`. Вход в кабинет выполняйте через HTTPS-домен; обычный HTTP по IP предназначен только для проверки общедоступного health endpoint.

## 7. Первый вход

Откройте `https://chhl.ru/office`. Логин — `admin`. Начальный пароль можно посмотреть в своём SSH-терминале:

```bash
cd ~/hockey-os
sed -n 's/^INITIAL_ADMIN_PASSWORD=//p' .env.production
```

Сохраните его в менеджере паролей. Пароль `Hockey2026!` и локальные демо-аккаунты в новой production-базе не действуют.

Проверьте главную страницу, вход, создание команды, турнира и назначение секретаря. Затем заполните данные сообщества и создайте рабочие учётные записи через кабинет. Сохранение результатов в первой версии выполняется после матча.

## 8. Резервное копирование

```bash
cd ~/hockey-os
bash scripts/backup-production.sh
```

Скрипт создаёт custom-format `pg_dump` в `~/hockey-os/backups/`. Только успешно завершившийся дамп получает расширение `.dump`. Файлы доступны владельцу. Дополнительно сохраняйте `.env.production` в защищённом хранилище и копируйте дампы за пределы этой ВМ.

Для ежедневного копирования можно добавить задачу в `crontab -e` того же пользователя, который имеет доступ к Docker. Подставьте реальный абсолютный путь из `pwd`:

```cron
15 3 * * * /bin/bash /home/USER/hockey-os/scripts/backup-production.sh >> /home/USER/hockey-os/backups/cron.log 2>&1
```

Сначала выполните резервное копирование вручную, чтобы каталог `backups` существовал. Время cron определяется часовым поясом сервера: проверьте `timedatectl`; при `Europe/Moscow` пример запускается в 03:15 МСК. Автоматическое удаление старых копий не настраивается этой инструкцией.

Для проверки восстановления сначала используйте отдельную тестовую базу или отдельный стенд. Не направляйте `pg_restore --clean` в рабочую базу хоккея, «Лиги двора» или sport-cheb.

## 9. Обновление и возврат к предыдущему образу

Перед обновлением создайте дамп, зафиксируйте текущий тег и сохраните копию `.env.production`:

```bash
cd ~/hockey-os
bash scripts/backup-production.sh
umask 077
cp .env.production "backups/env-$(date +%Y%m%d-%H%M%S)"
grep '^HOCKEY_IMAGE_TAG=' .env.production
```

Загрузите новый архив исходников и проверьте его контрольную сумму. Сохраните текущие исходники вне рабочего каталога, затем распакуйте обновление. Архив не содержит `.env.production` и данных PostgreSQL:

```bash
cd ~/hockey-os
tar --exclude=node_modules --exclude=dist --exclude=.angular \
    -czf "../hockey-os-before-$(date +%Y%m%d-%H%M%S).tar.gz" \
    Dockerfile .dockerignore compose.production.yml package.json pnpm-lock.yaml \
    pnpm-workspace.yaml backend frontend scripts infrastructure docs README.md
tar -xzf ~/hockey-os-source.tar.gz -C ~/hockey-os
```

Создайте новый тег и сначала соберите образ, оставляя работающий контейнер на месте:

```bash
cd ~/hockey-os
release="release-$(date -u +%Y%m%d-%H%M%S)"
HOCKEY_IMAGE_TAG="$release" bash scripts/production.sh build app
```

Только после успешной сборки переключите тег и пересоздайте приложение:

```bash
sed -i "s/^HOCKEY_IMAGE_TAG=.*/HOCKEY_IMAGE_TAG=$release/" .env.production
bash scripts/production.sh up -d --no-deps --wait --wait-timeout 180 app
bash scripts/production.sh ps
curl --fail --show-error http://127.0.0.1:8082/api/health
```

Будет краткий перерыв в работе хоккейного приложения. Контейнер его базы и два соседних приложения этим обновлением не перезапускаются.

Для возврата укажите предыдущий тег в `HOCKEY_IMAGE_TAG` и выполните:

```bash
nano .env.production
bash scripts/production.sh up -d --no-deps --no-build --pull never --wait --wait-timeout 180 app
```

Возврат образа не откатывает миграции базы. Если новая версия изменила схему несовместимо, восстановление согласованной пары «код + база» выполняется отдельно из сохранённой копии. Не удаляйте предыдущий образ до проверки обновления.

## Диагностика

| Проблема | Что проверить |
|---|---|
| Nginx возвращает 502 | `production.sh ps`, журналы `app`, health по `127.0.0.1:8082` и совпадение порта в Nginx |
| Вход отвечает «Недопустимый источник» | точное значение `FRONTEND_ORIGIN`, HTTPS и отсутствие завершающего `/` |
| После входа снова предлагается войти | HTTPS-домен и Secure-cookie; не проверять авторизацию по HTTP/IP |
| База отклоняет пароль | существующий том и первоначальный пароль; смена переменной окружения сама пароль роли не меняет |
| Ошибка первой установки | `INITIAL_ADMIN_PASSWORD`, длина JWT, запрет демонстрационного пароля в production |
| Обновление оборвалось при сборке | свободная память/диск и журнал Docker; работающий образ меняется только после успешной сборки |
| Нет команд и матчей | это ожидаемо для новой production-базы с `DEMO_SEED=false` |

Для временной остановки только хоккейного приложения используйте `bash scripts/production.sh stop app`. Не выполняйте `down -v`, `docker volume prune` или `docker system prune --volumes` на общей ВМ: данные приложений должны сохраняться.
