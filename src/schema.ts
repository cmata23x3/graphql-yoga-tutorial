import { makeExecutableSchema } from "@graphql-tools/schema"
import { GraphQLError } from "graphql"
import type { GraphQLContext } from "./context";
import type { Link, User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { compare, hash } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { APP_SECRET } from "./auth";

/* GraphQL schema definition language (SDL)
*  This descibes what data can be retrieved from the schema
*/
const typeDefinitions = `
    type Query {
        info: String!
        me: User!
        feed(filterNeedle: String, skip: Int, take: Int): [Link!]!
        comment(id: ID!): Comment
        link(id: ID!): Link
    }

    type Mutation {
        postLink(url: String!, description: String!): Link!
        postCommentOnLink(linkId: ID!, body: String!): Comment!
        signup(email: String!, password: String!, name: String!): AuthPayload
        login(email: String!, password: String!): AuthPayload
    }

    type Subscription {
        newLink: Link!
    }

    type Link {
        id: ID!
        description: String!
        url: String!
        comments: [Comment!]!
        postedBy: User
    }

    type Comment {
        id: ID!
        body: String!
        link: Link
    }

    type AuthPayload {
        token: String
        user: User
    }

    type User {
        id: ID!
        name: String!
        email: String!
        links: [Link!]!
    }
`

const parseIntSafe = (value: string): number | null => {
    if (/^(\d+)$/.test(value)) {
        return parseInt(value, 10)
    }
    return null
}

const isValidUrl = (value: string): boolean => {
    try {
        new URL(value)
        return true
    } catch (err) {
        return false
    }
}

const applyTakeConstraints = (params: {
    min: number,
    max: number,
    value: number,
}) => {
    if (params.value < params.min || params.value > params.max) {
        throw new GraphQLError(
            `'take' argument value '${params.value}' is outside the valid range  of '${params.min}' to '${params.max}'.`
        )
    }
    return params.value
}

const applySkipConstraints = (value: number) => {
    if (value <= -1) {
        throw new GraphQLError(
            `'skip' argument value '${value}' cannot be a negative.`
        )
    }
    return value 
} 

/**
 * Resolvers are used for resolving the data from the databases for Query operations 
 * and for storing data on Mutation operations
 */
const resolvers = {
    Query: {
        info: () => `This is the API of a Hackernews Clone`,
        me(
            parent: unknown,
            args: {},
            context: GraphQLContext
        ) {
            if (context.currentUser === null) {
                throw new Error('Unauthenticated')
            }
            return context.currentUser
        },
        async feed(
            parent: unknown,
            args: { filterNeedle?: string, skip?: number, take?: number,  },
            context: GraphQLContext
        ) {
            const where = args.filterNeedle
                ? {
                    OR: [
                        { description: { contains: args.filterNeedle } },
                        { url: { contains: args.filterNeedle } },
                    ]
                } : {}
            const take = applyTakeConstraints({
                min: 1,
                max: 50,
                value: args.take ?? 30
            })
            
            const skip = applySkipConstraints(args.skip ?? 0)
             
            return context.prisma.link.findMany({
                where,
                skip,
                take,
            })
        },
        async comment(
            parent: unknown,
            args: { id: string },
            context: GraphQLContext
        ) {
            return context.prisma.comment.findUnique({
                where: {
                    id: parseInt(args.id)
                }
            })
        },
        async link(
            parent: unknown,
            args: { id: string },
            context: GraphQLContext,
        ) {
            return context.prisma.link.findUnique({
                where: {
                    id: parseInt(args.id)
                }
            })
        }
    },
    Link: {
        id: (parent: Link) => parent.id,
        description: (parent: Link) => parent.description,
        url: (parent: Link) => parent.url,
        postedBy(
            parent: Link,
            args: {},
            context: GraphQLContext,
        ) {
            if (!parent.postedById) {
                return null
            }

            return context.prisma.link
                .findUnique({ where: { id: parent.id }})
                .postedBy()
        },
        comments(parent: Link, args: {}, context: GraphQLContext) {
            return context.prisma.comment.findMany({
                where: {
                    linkId: parent.id,
                }
            })
        }
    },
    User: {
        links: (parent: User, args: {}, context: GraphQLContext) =>
            context.prisma.user.findUnique({ where: { id: parent.id }}).links()
    },
    Mutation: {
        async postLink(
            parent: unknown,
            args: { description: string; url: string },
            context: GraphQLContext
        ) {
            if (context.currentUser === null) {
                throw new Error('Unauthenticated')
            }
            // Check that the description is not an empty string
            if (!args.description) {
                return Promise.reject(
                    new GraphQLError("Cannot create link with an empty description")
                )
            }

            if (!isValidUrl(args.url)) {
                return Promise.reject(
                    new GraphQLError("Cannot create link with an invalid url")
                )
            }

            const newLink = await context.prisma.link.create({
                data: {
                    url: args.url,
                    description: args.description,
                    postedBy: { connect: { id: context.currentUser.id }}
                }
            })

            // Publish events to anyone subscribed
            context.pubSub.publish('newLink', { newLink })

            return newLink  
        },
        async postCommentOnLink(
            parent: unknown,
            args: { linkId: string; body: string },
            context: GraphQLContext,
        ) {
            // Check that the linkId is a valid integer
            const linkId = parseIntSafe(args.linkId)
            if (linkId === null) {
                return Promise.reject(
                    new GraphQLError(
                        `Cannot post comment on non-existing link with id ${args.linkId}`
                    )
                )
            }

            // Check that the comment body is not an empty string
            if (!args.body) {
                return Promise.reject(
                    new GraphQLError("Cannot post an empty comment")
                )
            }

            const newComment = await context.prisma.comment
                .create({
                    data: {
                        linkId: parseInt(args.linkId),
                        body: args.body,
                    }
                })
                .catch((err: unknown) => {
                    // Handle case if the linkId doesn't exist
                    if (
                        err instanceof PrismaClientKnownRequestError &&
                        err.code === 'P2003'
                    ) {
                        return Promise.reject(
                            new GraphQLError(
                                `Cannot post comment on non-existing link with id ${args.linkId}`
                            )
                        )
                    }
                    return Promise.reject(err)
                })
            return newComment
        },
        async signup(
            parent: unknown,
            args: { email: string; password: string; name: string },
            context: GraphQLContext
        ) {
            const password = await hash(args.password, 10)
            const user = await context.prisma.user.create({
                data: { ...args, password }
            })
            const token = sign({ userId: user.id}, APP_SECRET)

            return { token, user }
        },
        async login(
            parent: unknown,
            args: { email: string, password: string },
            context: GraphQLContext
        ) {
            const user = await context.prisma.user.findUnique({
                where: { email: args.email }
            })
            if (!user) {
                throw new Error('No such user found')
            }
            const valid = await compare(args.password, user.password)
            if (!valid) {
                throw new Error('Invalid password')
            }
            const token = sign({ userId: user.id }, APP_SECRET)
            return { token, user }
        }
    },
    Subscription: {
        newLink: {
            subscribe: (parent: unknown, args: {}, context: GraphQLContext) => context.pubSub.subscribe('newLink')
        }
    },
}

/**
 * Combination of the GraphQL SDL and the resolvers
 */
export const schema = makeExecutableSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions],
})
