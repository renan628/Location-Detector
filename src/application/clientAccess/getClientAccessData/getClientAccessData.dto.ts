import { ClientAccessData } from "../../../domain/clientAccess/clientAccess";

export type InputClientAccessDTO = Pick<
  ClientAccessData,
  "clientID" | "ip" | "timestamp"
>;

export type OutputClientAccessDTO = ClientAccessData;

export const validadeInputClientAccessDTO = (input: InputClientAccessDTO) => {
  const { clientID, ip, timestamp } = input;
  const errors = [];

  if (typeof clientID != "string") errors.push("Client ID must be a string");
  if (typeof ip != "string") errors.push("IP must be a string");
  if (typeof timestamp != "number" || timestamp < 0)
    errors.push("Timestamp must be positive a number");

  if (errors.length > 0)
    throw new Error(`Invalid input:\n${errors.join("\n")}`);
};
