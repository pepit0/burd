# Expo / Node app for burd-rg1taa ONLY — not burd-inference (use server/).
# See docs/deploy-fly-inference.md

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start Expo for burd-rg1taa. Refuse to run if mis-deployed to burd-inference.
EXPOSE 3000
CMD ["sh", "-c", "if [ \"${FLY_APP_NAME:-}\" = \"burd-inference\" ]; then echo 'FATAL: burd-inference must deploy from server/ (GitHub Action: Deploy inference to Fly.io), not this Expo image.' >&2; exit 1; fi; exec npm run start"]
