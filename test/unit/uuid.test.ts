import { describe, expect, it } from "vitest";
import {
  ELEMENT_ID_NAMESPACE,
  OWNED_ELEMENT_ID_NAMESPACE,
  uuidV5,
} from "../../server/src/utils/uuid.js";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  it("gives the published version 5 UUID of www.example.com in the DNS namespace", () => {
    expect(uuidV5(DNS_NAMESPACE, "www.example.com")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("gives the same UUID for the same name and a different one for another name", () => {
    expect(uuidV5(ELEMENT_ID_NAMESPACE, "Demo::Vehicle")).toBe(
      uuidV5(ELEMENT_ID_NAMESPACE, "Demo::Vehicle"),
    );
    expect(uuidV5(ELEMENT_ID_NAMESPACE, "Demo::Vehicle")).not.toBe(
      uuidV5(ELEMENT_ID_NAMESPACE, "Demo::vehicle"),
    );
    expect(uuidV5(ELEMENT_ID_NAMESPACE, "Demo::Vehicle")).not.toBe(
      uuidV5(ELEMENT_ID_NAMESPACE, "demo::Vehicle"),
    );
  });

  it("gives the same name different UUIDs in the two element namespaces", () => {
    expect(uuidV5(OWNED_ELEMENT_ID_NAMESPACE, "Demo::Vehicle")).not.toBe(
      uuidV5(ELEMENT_ID_NAMESPACE, "Demo::Vehicle"),
    );
  });

  it("derives the element namespaces from their documented URLs", () => {
    expect(
      uuidV5(URL_NAMESPACE, "https://github.com/daltskin/sysml-v2-lsp/element"),
    ).toBe(ELEMENT_ID_NAMESPACE);
    expect(
      uuidV5(
        URL_NAMESPACE,
        "https://github.com/daltskin/sysml-v2-lsp/owned-element",
      ),
    ).toBe(OWNED_ELEMENT_ID_NAMESPACE);
  });
});

describe("elementId", () => {
  const UUID_V5 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("gives an anonymous element the version 5 UUID of its owner and its declaration", async () => {
    const { parseDocument } =
      await import("../../server/src/parser/parseDocument.js");
    const { SymbolTable } =
      await import("../../server/src/symbols/symbolTable.js");
    const st = new SymbolTable();
    st.build(
      "file:///w/a.sysml",
      parseDocument("package D { part def P; part : P; }"),
    );
    const owner = st.getSymbol("D")!;
    const anonymous = st
      .getSymbolsForUri("file:///w/a.sysml")
      .find((s) => s.kind === "part" && s.name === "")!;
    expect(anonymous.elementId).toMatch(UUID_V5);
    // Without a qualified name, it is identified in the owned-element namespace.
    expect(anonymous.elementId).toBe(
      uuidV5(
        OWNED_ELEMENT_ID_NAMESPACE,
        `anonymous/${owner.elementId}/part:part : P:P:`,
      ),
    );
    // A named element is identified by its qualified name.
    expect(owner.elementId).toBe(uuidV5(ELEMENT_ID_NAMESPACE, "D"));
    expect(st.getSymbol("D::P")!.elementId).toBe(
      uuidV5(ELEMENT_ID_NAMESPACE, "D::P"),
    );
  });
});
