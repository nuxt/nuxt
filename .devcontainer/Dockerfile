FROM node:lts@sha256:7bea049c66b5846c4ce2786b1b4e32865ef11b10fa446c1bfd791daea412c299

RUN apt-get update && \
    apt-get install -fy libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}

RUN corepack enable && npx playwright install
