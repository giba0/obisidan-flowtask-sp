import { describe, expect, it } from "vitest";
import { applySuggestion, getSuggestions } from "../src/domain/autocomplete";

const projects = [{ id: "1", name: "Casa" }, { id: "2", name: "Trabalho" }];
const tags = [{ id: "1", name: "compras" }, { id: "2", name: "urgente" }];

describe("quick capture autocomplete", () => {
  it("filters projects after + and tags after #", () => {
    expect(getSuggestions("Comprar +ca", 11, projects, tags)).toMatchObject([{ kind: "project", value: "+Casa" }]);
    expect(getSuggestions("Comprar #ur", 11, projects, tags)).toMatchObject([{ kind: "tag", value: "#urgente" }]);
  });

  it("offers relative dates and replaces only the active token", () => {
    const suggestions = getSuggestions("Reunião @tom", 12, projects, tags);
    expect(suggestions).toMatchObject([{ value: "@tomorrow" }]);
    expect(applySuggestion("Reunião @tom às 10h", 12, suggestions[0])).toMatchObject({ value: "Reunião @tomorrow às 10h", cursor: 17 });
  });
});
