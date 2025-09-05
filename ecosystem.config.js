module.exports = {
  apps: [{
    name: "svelte",
    script: "build/index.js",
    env: {
      PORT: 3001,
      POSTGRES_USER: "bastu_admin",
      POSTGRES_PASSWORD: "bastupassword", 
      POSTGRES_DB: "bastudb",
      POSTGRES_HOST: "localhost",
      POSTGRES_PORT: 5433,
      // Add other env vars as needed
    }
  }]
};

// pm2 startup config for cloudpanel "pm2 start ecosystem.config.js"