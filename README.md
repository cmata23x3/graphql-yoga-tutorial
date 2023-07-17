# GraphQL-Yoga Tutorial

Worked through the [GraphQL Yoga tutorial](https://the-guild.dev/graphql/yoga-server/tutorial/basic). This tutorial works through setting up a GraphQL HTTP server using `node.js`, written in  `TypeScript`.

The personal goal is to learn more about the GraphQL paradigm for API servers. There hadn't been an opportunity to use this in previous projects and the technology is quickly becoming a more, more common replacement for REST APIs that I have previously used in school and professionally.

# Quick Start
Developed on `node 18.16.0`.

* `npm run dev` - start the server in development mode; has quick reload

* `npm start` - start the server in production mode

* `npx prisma studio` - open up web based interactive database tool; opens on http://localhost:5555

# Personal Notes
Project uses SDL-first approach for defining GraphQL syntax as opposed to a code-first approach done in other tutorials. Going with the SDL-first approach, it was a bit clearer how Prisma worked under the hood and some better intuition can be applied to the code-first approach if done later. 