import { makeExecutableSchema } from "@graphql-tools/schema"

/* GraphQL schema definition language (SDL)
*  This descibes what data can be retrieved from the schema
*/
const typeDefinitions = `
    type Query {
        hello: String!
    }
`

/**
 * Resolvers are used for resolving the data. 
 */
const resolvers = {
    Query: {
        hello: () => 'Hello World!'
    }
}

/**
 * Combination of the GraphQL SDL and the resolvers
 */
export const schema = makeExecutableSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions],
})
