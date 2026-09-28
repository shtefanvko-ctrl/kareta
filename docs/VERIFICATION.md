# KARETA.KZ verification contract

DONE does not mean "code changed". DONE means the intended user scenario has been executed and evidence shows it works without breaking protected scenarios.

## Delivery flow

1. Plan — define scope, acceptance criteria and dependencies.
2. Implement — change only what the feature requires.
3. Verify — test against the acceptance criteria independently of implementation reasoning.
4. Regression — execute checks for dependent and previously working scenarios.
5. Integrate — merge only when mandatory checks pass.

## Minimum evidence

Each non-trivial change should record:
- affected route or entry point;
- affected API/data/state;
- acceptance criteria;
- verification steps and result;
- regression dependencies;
- known risks and rollback notes.

## Automated gates

After the real application code is synchronized into this repository, CI must at minimum provide:
- PHP syntax/static checks appropriate to the project;
- JavaScript checks appropriate to the project;
- secret scanning;
- automated smoke/regression checks for critical routes and APIs;
- test execution for any test framework present in the repository.

A failing mandatory gate blocks merge.
