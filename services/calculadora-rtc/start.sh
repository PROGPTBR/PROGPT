#!/bin/sh
# Sobe as duas calculadoras e o roteador. Se qualquer processo cair, o contêiner
# encerra e o Railway reinicia (melhor que ficar meio de pé).
set -e
cd /app/regime
java -XX:MaxRAMPercentage=35 -XX:+UseSerialGC -Dspring.profiles.active=offline \
  -Dserver.port=8080 -jar api-regime-geral.jar &
REG=$!
cd /app/simples
java -XX:MaxRAMPercentage=30 -XX:+UseSerialGC -Dspring.profiles.active=offline \
  -Dserver.port=8082 -Dmanagement.server.port=9103 -jar api-simples-nacional.jar &
SN=$!
caddy run --config /app/Caddyfile --adapter caddyfile &
CADDY=$!
# Encerra tudo se um dos três parar.
while kill -0 $REG 2>/dev/null && kill -0 $SN 2>/dev/null && kill -0 $CADDY 2>/dev/null; do
  sleep 5
done
echo "um dos processos parou; encerrando" >&2
kill $REG $SN $CADDY 2>/dev/null || true
exit 1
