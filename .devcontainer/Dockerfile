FROM node:lts@sha256:5c76d05034644fa8ecc9c2aa84e0a83cd981d0ef13af5455b87b9adf5b216561

RUN apt-get update && \
    apt-get install -fy libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}

RUN corepack enable && npx playwright install
