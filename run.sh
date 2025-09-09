if [ ! -f "./api/dist/main.mjs" ]; then
    pnpm api:build
fi

if [ ! -f "./client/public/pack/entry.js" ]; then
    pnpm client:build:prod
fi

if [ ! -f "./apps/about/dist/app.pack.js" ]; then
    pnpm apps:build:prod
fi

node --env-file envs/prod.env --enable-source-maps --watch-path api/dist . $@
