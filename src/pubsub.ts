import { Link, Vote } from "@prisma/client"
import { createPubSub } from "graphql-yoga"

export type PubSubChannels = {
    newLink: [{ newLink: Link }],
    newVote: [{ newVote: Vote }],
}

export const pubSub = createPubSub<PubSubChannels>()
