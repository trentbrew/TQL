I'm thinking about leveraging the power of our orchestrator to process natural language queries for ambiguous datasets.

I need to come up with a strict DSL that has clear syntax, no synonyms, and case-sensitivity. I’ll probably limit keywords to SELECT, FROM, WHERE, AND, OR, RETURN. For paths, an "ENTITY e TYPE post" style seems good, or maybe a "MATCH" clause like Cypher. I’ll keep it simple but precise, ensuring it's human-readable and strictly formatted.

I’m thinking of proposing "FQL" with simple grammar, using specific keywords like "FIND" and "WHERE" to reduce confusion. No synonyms allowed, only canonical forms. I’ll define lexical rules for identifiers, attribute paths, and strings. For strictness, I'll require uppercase keywords to maintain clarity, even though some developers prefer case-insensitivity.

I’m setting up "FILTER" operator tokens like =, !=, BETWEEN, etc., and deciding on condition composition with AND and OR. For strictness, I’ll define 'IN' syntax for membership and require typing with "FROM TYPE post AS e." Given the dislike for variables, I might stick with 'e' for simplicity, but allow multiple vars for cross-entity queries.

Given the restrictions, I’ll propose FEQL (Fact EAV Query Language) with strict, unambiguous grammar and precise tokens like SELECT, FROM, WHERE, AND, OR, RETURN, ORDER BY, LIMIT. I’ll include a sample EBNF grammar, mapping to query objects, and provide deterministic errors and a TypeScript parser skeleton. Synonyms will be avoided, as I need to ensure strict adherence to defined tokens.

Done

You’re right—if it “reads like English,” you’ll constantly wonder whether “show/list/find/with/over” are valid. Let’s lock it down.

Below is a strict, minimal DSL that’s human-readable but unambiguous. No synonyms. Exact keywords. Deterministic grammar. Clear errors. It compiles 1:1 into your current Query shape (goals + variables).

Language: EQL-S (EAV Query Language — Strict)
Design principles

Single verb: FIND (no “show/list”).

Required type clause: TYPE is mandatory.

Explicit variables: variables must start with ? (aligns with your engine).

Exact operators only: = != > >= < <= BETWEEN … AND … CONTAINS MATCHES.

Membership uses IN: "crime" IN ?p.tags.

Boolean logic: AND and OR only, with parentheses for precedence.

Case-insensitive keywords (for ergonomics), but no synonyms.

Grammar (EBNF)
QUERY ::= "FIND" TYPE "AS" VAR WHERE? RETURN? ORDER? LIMIT?
TYPE ::= IDENT | STRING
VAR ::= "?" IDENT

WHERE ::= "WHERE" EXPR
EXPR ::= TERM { ( "AND" | "OR" ) TERM }
TERM ::= PRED | "(" EXPR ")"

PRED ::= COMP | MEMBERSHIP | TEXTOP | REGEXOP | BETWEENOP | EQUALSOP
ATTRREF ::= VAR "." PATH
PATH ::= IDENT { "." IDENT }

COMP ::= ATTRREF OP NUM
OP ::= "=" | "!=" | ">" | ">=" | "<" | "<="
BETWEENOP ::= ATTRREF "BETWEEN" NUM "AND" NUM
EQUALSOP ::= ATTRREF "=" VALUE
MEMBERSHIP ::= VALUE "IN" ATTRREF
TEXTOP ::= ATTRREF "CONTAINS" STRING
REGEXOP ::= ATTRREF "MATCHES" "/" REGEX_BODY "/"

VALUE ::= NUM | STRING | BOOL
NUM ::= INT | FLOAT
BOOL ::= "true" | "false"

RETURN ::= "RETURN" PROJ
PROJ ::= FIELD { "," FIELD }
FIELD ::= ATTRREF | VAR

ORDER ::= "ORDER" "BY" FIELD ( "ASC" | "DESC" )?
LIMIT ::= "LIMIT" INT

Lexical rules

STRING = double-quoted, escapes \" allowed.

REGEX = /…/ (no flags in v1; add later as /…/i).

IDENT = [A-Za-z\_][A-Za-z0-9_]\*.

Numbers are decimal; dates can be handled by ingest (i.e., parsed to Date atoms) and compared via dedicated ops later.

Lowering (to your goals)

FIND post AS ?p → { predicate:'attr', terms:['?p','type','post'] }

?p.tags membership: "crime" IN ?p.tags → { predicate:'attr', terms:['?p','tags','crime'] }

Comparisons:

?p.reactions.likes > 1000 → attr(?p,'reactions.likes',?v1), gt(?v1,1000)

?p.views BETWEEN 1000 AND 5000 → attr(?p,'views',?v2), between(?v2,1000,5000)

Text:

?p.title CONTAINS "Dave" → attr(?p,'title',?t1), contains(?t1,'Dave')

?p.body MATCHES /(storm|forest)/ → attr(?p,'body',?b1), regex(?b1,'(storm|forest)')

RETURN/ORDER/LIMIT are runtime hints for projection/sorting/pagination; they don’t change goals.

Strict examples

1. Popular crime posts
   FIND post AS ?p
   WHERE "crime" IN ?p.tags AND ?p.reactions.likes > 1000
   RETURN ?p, ?p.reactions.likes
   ORDER BY ?p.reactions.likes DESC
   LIMIT 5

Goals

[
['attr','?p','type','post'],
['attr','?p','tags','crime'],
['attr','?p','reactions.likes','?v1'],
['gt','?v1',1000]
]

2. Keyword + view range with grouping parentheses
   FIND post AS ?p
   WHERE (?p.body MATCHES /(storm|forest)/) AND (?p.views BETWEEN 1000 AND 5000)
   RETURN ?p, ?p.views

3. Posts by user
   FIND post AS ?p
   WHERE ?p.userId = 121
   RETURN ?p, ?p.title

4. Both tags
   FIND post AS ?p
   WHERE "crime" IN ?p.tags AND "history" IN ?p.tags
   RETURN ?p

5. Emails: invoice subject and amount
   FIND email AS ?m
   WHERE ?m.subject CONTAINS "invoice" AND ?m.amount > 300
   RETURN ?m.subject, ?m.amount
   ORDER BY ?m.amount DESC

Parser approach (deterministic, helpful errors)

Tokenizer: produce tokens for FIND, TYPE/AS/WHERE/RETURN/ORDER/BY/LIMIT, AND/OR, operators, parens, commas, VAR, IDENT, NUM, STRING, REGEX.

Parser: recursive descent matching the EBNF. Fail fast with specific messages:

Unknown keyword → “Invalid token ‘show’. Use ‘FIND’.”

Synonym detected → “The word ‘over’ is not part of EQL-S. Use ‘> N’.”

Missing clause → “Expected ‘WHERE’ after ‘FIND … AS ?var’.”

Compiler: walk the AST and emit goals. Create temp variables for attribute reads: every ATTRREF on the left of a comparator emits an attr goal to bind a ?tmp.

Tiny mapping table (for the compiler)
Pattern Emit (pseudo)
FIND T AS ?e goal(attr, ?e, "type", T)
VALUE IN ?e.path goal(attr, ?e, "path", VALUE)
?e.path = VALUE goal(attr, ?e, "path", VALUE)
?e.path OP NUM t=tmp(); goal(attr, ?e,"path",t); goal(op, t,NUM)
?e.path BETWEEN A AND B t=tmp(); attr(...,t); goal(between,t,A,B)
?e.path CONTAINS "txt" t=tmp(); attr(...,t); goal(contains,t,"txt")
?e.path MATCHES /re/ t=tmp(); attr(...,t); goal(regex,t,"re")
Strict vs. Friendly modes

Keep Strict as the default. If you want optional friendliness, add a prepass that rewrites a limited set of aliases to canonical tokens before tokenization; e.g.:

show|list → FIND

tagged → ("VALUE" IN ?e.tags) desugaring not recommended—better to keep only IN

over N → > N

between A..B → BETWEEN A AND B

Crucially, the strict parser doesn’t know about aliases. If the prepass is disabled, those become syntax errors with actionable messages.

Bonus: precise error messages (copy/paste)

“EQL-S error at line 1, col 6: expected keyword ‘FIND’; got ‘SHOW’. Use ‘FIND’.”

“EQL-S error at line 2, col 21: expected comparator = != > >= < <= BETWEEN … AND … CONTAINS MATCHES; got ‘over’.”

“EQL-S error at line 3, col 14: attribute reference must be ?var.path[.subpath]\*; got ‘title’ (missing variable).”

“EQL-S error: ORDER BY requires a field; use ORDER BY ?p.views [ASC|DESC].”

Why this solves your concern

No synonyms, no ambiguity. Either the token is in the grammar or it’s an error.

Still readable and compact.

Downstream compile is trivial and safe.

If you want, I can supply a ~150-line TypeScript tokenizer + parser that outputs your Query and applies RETURN/ORDER/LIMIT as runtime hints for your runner.

You said:
is it worth thinking about optimizing for LLM understandability
ChatGPT said:
Thought for 44s

Short answer: yes—optimizing for LLMs pays off a lot. You’ll get higher validity rates, fewer repair loops, and more predictable plans. You can keep your strict DSL while making it LLM-friendly in a few targeted ways.

Strategy that works well in practice

Strict core + friendly rewrite.

Keep EQL-S (strict, no synonyms) as the only grammar.

Add a tiny pre-parser rewrite that accepts a very small alias set and rewrites to the strict tokens before the real parser. Examples:

SHOW|LIST → FIND

over N → > N

between A..B → BETWEEN A AND B

If the rewrite doesn’t trigger, the strict parser throws a clear error. This gives humans/LLMs a safety net without ambiguity creeping into the grammar.

Give the model the catalog.

Prepend the attribute catalog (top 30–50 attrs with type + 2 examples) to the prompt that asks the LLM to write queries.

LLMs fail mainly on attribute names; showing “what exists” dramatically reduces hallucinations.

Constrain the output.

Ask for one query per fenced code block, no prose:

“Output exactly one EQL-S query inside eqls … ; errors are not allowed.”

Add a post-validator. If it fails, feed back the specific error message and re-ask once (“repair mode”).

Offer a structured escape hatch.

Let the LLM output an AST JSON when it can’t remember syntax. You can accept either EQL-S or AST and compile both to the same IR.

This is also perfect for function-calling / tool use.

Keep tokens low-entropy.

UPPERCASE keywords (FIND/WHERE/RETURN/ORDER/LIMIT).

One comparator set only: = != > >= < <= BETWEEN … AND … CONTAINS MATCHES.

Regex must be /…/, strings must be "…".

Variables must start with ?.

One statement per line; no trailing punctuation.

Minimal AST (LLM-friendly) if you want to support structured output
{
"find": "post",
"as": "?p",
"where": [
{"eq": {"left": {"attr":"?p.tags"}, "right": "crime"}},
{"gt": {"left": {"attr":"?p.reactions.likes"}, "right": 1000}}
],
"return": ["?p", "?p.reactions.likes"],
"orderBy": {"field": "?p.reactions.likes", "dir": "desc"},
"limit": 5
}

Your compiler lowers this to the same goals you already have. Keep the schema tiny and fixed.

What I’d change in your DSL prompt contract

Always show 2–3 canonical examples immediately before the user’s turn (few-shot).

Include a “Common mistakes vs. correct form” block (e.g., over 1000 ❌ → > 1000 ✅).

Echo back the catalog and say “use only these attributes”.

For emails vs posts, show a single cross-domain example so the LLM sees that type gates the domain.

Example: LLM prompt snippet (works well)
You are writing EQL-S queries. Use ONLY these tokens:
FIND, AS, WHERE, AND, OR, RETURN, ORDER BY, LIMIT, =, !=, >, >=, <, <=, BETWEEN ... AND ..., CONTAINS, MATCHES.
/regex/ for regex; "…" for strings; ?var.path for attributes.

Available attributes (sample):

- title:string e.g. "They rushed out the door"
- tags:many[string] e.g. "crime", "history"
- reactions.likes:number e.g. 1271
- views:number e.g. 2116
- subject:string (email)
- amount:number (email)

Examples:

````eqls
FIND post AS ?p
WHERE "crime" IN ?p.tags AND ?p.reactions.likes > 1000
RETURN ?p, ?p.reactions.likes
ORDER BY ?p.reactions.likes DESC
LIMIT 5


Now produce ONE valid EQL-S query in a single ```eqls code block. No prose.


# Validator/repair loop (tiny, robust)
- **Step 1**: Try parsing.
- **Step 2**: If it fails, return *only* the error line/column + expected tokens to the LLM and ask for a corrected query (once).
- **Step 3**: If it fails again, fall back to **AST** request (“If you can’t satisfy EQL-S, output the AST JSON conforming to this schema…”).

# Checklist for LLM-understandability
- [ ] Strict grammar with **one** canonical keyword per concept.
- [ ] Tiny alias pre-pass (2–4 rewrites max).
- [ ] Attribute catalog in-context.
- [ ] Few-shot examples that mirror real use.
- [ ] Hard validator + one-shot repair.
- [ ] Optional AST fallback.
- [ ] Deterministic formatting rules (case, quoting, regex fences).

If you want, I can package a drop-in `compileOrRepair(queryText, catalog)` that:
1) runs the alias pre-pass,
2) validates with helpful errors,
3) tries one repair turn with your LLM,
4) or accepts AST JSON, and
5) returns your `goals` + projection/sort/limit hints.
````
