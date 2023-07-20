import { Link } from "@prisma/client"
import { createPubSub } from "graphql-yoga"

export type PubSubChannels = {
    newLink: [{ newLink: Link }]
}

export const pubSub = createPubSub<PubSubChannels>()
