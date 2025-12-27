import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { groupService } from "@/services/group.service";

export const listNamesInGroupTool = tool(
  async ({ userId, groupId }) => {
    const group = await groupService.getGroupById(groupId, userId);

    return group.members.map((member) => `${member.user.id}: ${member.user.name}`).join("\n");
  },
  {
    name: "list_names_in_group",
    description: "Lists all names in a group",
    schema: z.object({
      userId: z.string().describe("The ID of the user"),
      groupId: z.number().describe("The ID of the group"),
    }),
  }
);
