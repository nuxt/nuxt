FROM node:lts@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63

RUN apt-get update && \
    apt-get install -fy libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}

RUN corepack enable && npx playwright install
