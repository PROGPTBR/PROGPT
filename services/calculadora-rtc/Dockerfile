# Calculadoras oficiais da Reforma Tributária do Consumo (Receita Federal / Serpro),
# código aberto (MIT): github.com/ReceitaFederal
#   - calculadora-rtc-regime-regular  (CBS, IBS e IS do regime normal)
#   - calculadora-rtc-simples-nacional (CBS e IBS das empresas do Simples Nacional)
# A base de regras (SQLite) é gerada pelo Flyway do repositório do regime regular e
# serve às duas. Para atualizar: troque as versões abaixo pela tag nova e publique.
ARG REGIME_TAG=1.6.1
ARG SIMPLES_TAG=0.0.6

FROM eclipse-temurin:21-jdk AS build
ARG REGIME_TAG
ARG SIMPLES_TAG
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch ${REGIME_TAG} https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git regime \
 && git clone --depth 1 --branch ${SIMPLES_TAG} https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git simples
WORKDIR /src/regime
RUN mkdir -p calculadora/db \
 && ./mvnw -q flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors \
 && ./mvnw -q -DskipTests package --batch-mode
WORKDIR /src/simples
RUN ./mvnw -q -DskipTests package --batch-mode

FROM caddy:2.8.4 AS caddy

FROM eclipse-temurin:21-jre
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
WORKDIR /app
COPY --from=build /src/regime/target/api-regime-geral.jar regime/api-regime-geral.jar
COPY --from=build /src/regime/calculadora regime/calculadora
COPY --from=build /src/simples/target/api-simples-nacional.jar simples/api-simples-nacional.jar
COPY --from=build /src/regime/calculadora simples/calculadora
COPY Caddyfile start.sh ./
ENV PORT=8000
EXPOSE 8000
CMD ["/app/start.sh"]
