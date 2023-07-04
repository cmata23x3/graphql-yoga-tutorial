import { makeExecutableSchema } from "@graphql-tools/schema"
import type { GraphQLContext } from "./context";
import type { Link } from "@prisma/client";

/* GraphQL schema definition language (SDL)
*  This descibes what data can be retrieved from the schema
*/
const typeDefinitions = `
    type Query {
        info: String!
        feed: [Link!]!
    }

    type Mutation {
        postLink(url: String!, description: String!): Link!
    }

    type Link {
        id: ID!
        description: String!
        url: String!
    }
`

/**
 * Resolvers are used for resolving the data from the databases for Query operations 
 * and for storing data on Mutation operations
 */
const resolvers = {
    Query: {
        info: () => `This is the API of a Hackernews Clone`,
        feed: (parent: unknown, args: {}, context: GraphQLContext) =>
            context.prisma.link.findMany()
    },
    Mutation: {
        async postLink(
            parent: unknown,
            args: { description: string; url: string },
            context: GraphQLContext
        ) {
            const newLink = await context.prisma.link.create({
                data: {
                    url: args.url,
                    description: args.description,
                }
        })
            return newLink  
        },
    },
}

/**
 * Combination of the GraphQL SDL and the resolvers
 */
export const schema = makeExecutableSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions],
})
