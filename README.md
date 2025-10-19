# JavaScript Abstract Syntax Tree (**AST**) Analyzer & Deobfuscator

This project provides tools to analyze potentially obfuscated JavaScript code found within HTML files. It includes:

1.  A **Node.js Deobfuscator Script** (`deobfuscator.js`): Attempts to reverse common JavaScript obfuscation patterns (specifically those used by obfuscator.io, involving string arrays and decoders) found within `<script>` tags in an HTML file.
2.  An **Interactive AST Viewer** (`AST-viewer.html`): A self-contained HTML/JavaScript application that parses JavaScript code using Esprima and displays its Abstract Syntax Tree (AST) as an interactive, collapsible, color-coded graph using D3.js.
3.  **Docker Setup** (`Dockerfile`, `docker-compose.yml`): Allows you to easily build and run the deobfuscator script in a containerized environment with all dependencies included.

The primary workflow involves running the deobfuscator on a target HTML file via Docker Compose. The script then generates a `file:///` URL containing the deobfuscated code, which you can paste into your browser to automatically load the AST viewer with the results.

---

## How Analysts Use the AST Graph for Static Analysis 🕵️‍♀️

Static analysis means examining code without running it. The AST graph is a powerful tool for this, especially with obfuscated JavaScript:

1.  **Unveiling Hidden Structures:** Obfuscation often hides the code's real logic using complex expressions, strange variable names, or deeply nested functions. The AST graph **visually lays out the *actual* grammatical structure**, making these complex patterns much easier to see and understand. You can quickly spot things like:
    * **Excessive nesting:** Indicating potentially convoluted logic.
    * **Unusual function calls:** Calls to functions that decode strings or perform anti-analysis checks.
    * **Large arrays or complex initializations:** Often part of string obfuscation.

2.  **Identifying Obfuscation Patterns:** Common obfuscation techniques create recognizable structures in the AST. For example:
    * **String Array Decoders:** Often appear as a specific pattern: a large `ArrayExpression` (the strings), a `FunctionDeclaration` (the decoder), and numerous `CallExpressions` referencing the decoder function throughout the code. The highlighting feature makes tracing these calls easy.
    * **Control Flow Flattening:** May appear as a large `WhileStatement` or `ForStatement` containing a `SwitchStatement` that jumps between code blocks based on a control variable.
    * **Anti-Debugging/Analysis:** Might show up as `TryStatement` blocks (`try/catch`) around sensitive operations or calls to specific functions (like `debugger` or performance timers).

3.  **Visual Data & Control Flow Tracing:** While not a true Control Flow Graph (CFG), the AST viewer helps you *visually* trace relationships:
    * **Data Flow:** Hover over or click an `Identifier` (variable name) or `Literal` (value). The highlighting and **Click-to-Reveal** features instantly show you *all other places* that specific variable or value is used or defined throughout the code's structure, helping you track how data moves.
    * **Control Flow:** Hover over or click the `Identifier` representing a function name (either in its declaration or a call). Highlighting shows where else it's called or defined, giving you a static map of function interactions.

4.  **Understanding Logic at a Glance:** The **color-coding** helps you immediately identify key logical blocks (Functions, If/Try, Loops, Return paths, True/False branches) even when the code text is unreadable. This provides a quick high-level understanding of what the script *might* be trying to do before diving into details.

By using these features, you can dissect the structure and potential behavior of obfuscated JavaScript statically, significantly speeding up the analysis process compared to just reading the raw, confusing code.

---

## Features ✨

* **Deobfuscation:** Attempts to resolve string array decoders, evaluate simple expressions, and clean up common obfuscation patterns.
* **AST Generation:** Parses JavaScript using Esprima to generate an Abstract Syntax Tree.
* **Interactive AST Graph:**
    * Visualizes the AST using D3.js as a collapsible tree graph.
    * Color-codes nodes based on their type (Functions, Loops, If/Try, Return, True/False/Catch blocks).
    * Displays detailed node information (type, key/index, value/name).
    * Highlights all instances of an Identifier or Literal when hovering over one.
    * Allows clicking on Identifiers/Literals to automatically reveal all matching nodes in the graph (with an option to collapse irrelevant branches).
    * Highlights the corresponding code in the input `<textarea>` when hovering over graph nodes.
    * Allows clicking within the input `<textarea>` to reveal and center the corresponding node in the graph.
    * Includes zoom and pan functionality.
* **Dockerized:** Bundles the deobfuscator and its Node.js environment for easy execution.

---

## Setup ⚙️

1.  **Prerequisites:**
    * [Docker](https://docs.docker.com/get-docker/) installed.
    * [Docker Compose](https://docs.docker.com/compose/install/) installed (often included with Docker Desktop).
    * [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed (for cloning).

2.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/virusvoyager/js-AST-static-analysis.git](https://github.com/virusvoyager/js-AST-static-analysis.git)
    cd js-AST-static-analysis
    ```

3.  **Build the Docker Image:**
    From within the project directory (e.g., `js-AST-static-analysis`), run:
    ```bash
    docker-compose build
    ```
    This command reads the `Dockerfile` via `docker-compose.yml` and builds the `js-deobfuscator` image, installing all Node.js dependencies inside it.

---

## Usage 🚀

1.  **Place Input File:** Put the suspicious HTML file you want to analyze (e.g., `input.html`) inside the project directory.

2.  **Run Deobfuscator via Docker Compose:**
    Execute the following command in your terminal, replacing `input.html` with your filename:
    ```bash
    docker-compose run --rm deobfuscator /data/input.html
    ```
    * `--rm`: Cleans up the container after it runs.
    * `deobfuscator`: The service name from `docker-compose.yml`.
    * `/data/input.html`: The path *inside the container* to your input file (because the project directory is mounted to `/data`).

3.  **Copy the Output URL:**
    The script will print logs and then output a URL similar to this:
    ```
    --- URL for AST Viewer ---
    file:///Users/YourUser/path/to/js-AST-static-analysis/AST-viewer.html#function%20sendToTelegram... (very long code) ...
    --------------------------
    Copy the URL above and paste it into your host machine's browser.
    ```
    **Copy the entire `file:///...` URL.**

4.  **Open in Browser:**
    Paste the copied URL into the address bar of your web browser **on your host machine**.

5.  **Analyze:**
    The AST viewer page will load, automatically populate the deobfuscated code into the left-hand text area, and render the interactive graph on the right. You can now explore the code structure and use the viewer's features.

---

## AST Viewer Features Summary 📊

* **View Code:** Deobfuscated code appears in the left text area.
* **View Graph:** Interactive AST graph appears on the right.
* **Expand/Collapse:** Click nodes (circles) to expand or collapse branches.
* **Hover Graph Node -> Highlight Code:** Hovering over graph nodes highlights the corresponding code snippet.
* **Hover Graph Node -> Highlight Graph:** Hovering over an Identifier/Literal node dims other text and highlights all matching Identifiers/Literals in red.
* **Click Code -> Reveal Graph:** Clicking inside the code text area finds the corresponding graph node, expands the tree to reveal it, centers the view on it, and flashes it yellow.
* **Click Graph Node (Identifier/Literal) -> Focus/Reveal:** Clicking an Identifier/Literal node prompts whether to collapse non-matching branches while expanding all branches needed to show the matches.
* **Color Coding:** Nodes are color-coded based on their logical function (If, Loop, Function, etc.) as shown in the legend.
* **Zoom/Pan:** Use the mouse wheel to zoom and click-drag the background to pan the graph.

---

## Open Source 🌐

This project is completely **open source**. You are free to use, study, modify, and distribute the code. Contributions and suggestions are welcome! Feel free to fork the repository, submit issues, or create pull requests.

---