<div align="center">
  <h1 align="center"><a href="https://www.gratitext.app">GratiText</a></h1>
  <strong align="center">
    Express gratitude and send nice notes to your loved ones
  </strong>
  <p>
    Gratitude is an important part of a healthy relationship. With this app, you
    can be reminded to thank those you love on a regular basis with personal
    messages.
  </p>
</div>

## Setup

1. Copy the example environment file:

   cp .env.example .env

2. Install dependencies:

   npm install

3. Run the development server:

   npm run dev

## Local sidecar testing (BullMQ)

1. Ensure Redis is available locally:

   npm run redis:local

   (Use `REDIS_URL=redis://localhost:6379/0` in `.env`; dummy Stripe/Twilio
   values are fine when running with mocks.)

2. Run the app + BullMQ sidecar with mocks:

   npm run dev:sidecar

3. Visit the app:

   http://localhost:3000

To run everything in one command (Redis + app + sidecar):

npm run dev:sidecar:redis

To stop the Redis container:

npm run redis:local:down

## Thanks

You rock 🪨
