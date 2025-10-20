/*
   Copyright 2025 virusvoyager

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
// --- 1. Imports ---
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const cheerio = require('cheerio');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

// --- 2. The Deobfuscate Function ---
async function deobfuscate(htmlContent) {
    const $ = cheerio.load(htmlContent);

    let scriptContent = '';
    $('script').each((index, element) => {
      // --- FIX: Use .text() instead of .html() ---
      // This correctly decodes HTML entities (e.g., &lt;) and can prevent illegal characters.
      const content = $(element).text();
      // --- END FIX ---

      if (content && content.includes('_0x')) {
        scriptContent = content;
        return false;
      }
    });

    if (!scriptContent) {
      console.error('Error: Could not find an *inline, obfuscated* <script> tag to deobfuscate.');
      return null;
    }
    console.log('Found target script tag, proceeding with parsing...');
    let ast;
    try {
      ast = parser.parse(scriptContent, { sourceType: 'script' });
    } catch (parseError) {
      // --- Enhanced Error Logging ---
      console.error('\n--- PARSING FAILED ---');
      console.error('Babel Parser Error:', parseError.message);

      const lines = scriptContent.split('\n');
      const errorLine = parseError.loc ? parseError.loc.line : -1;

      if (errorLine > 0) {
          console.error(`\n--- Code around the error on line ${errorLine} ---`);
          const start = Math.max(0, errorLine - 3);
          const end = Math.min(lines.length, errorLine + 2);
          for (let i = start; i < end; i++) {
              const lineNum = i + 1;
              const prefix = lineNum === errorLine ? '>> ' : '   ';
              console.error(`${prefix}${lineNum}: ${lines[i]}`);
          }
          console.error('------------------------------------------');
          console.error('Look for invisible characters or broken syntax on the line marked with ">>".');
      }
      // --- End Enhanced Error Logging ---
      return null; // Return null on parse failure
    }

    let changed = true; let iterations = 0; const maxIterations = 10;
    let stringArray = []; let decoderFunctionName = ''; let offset = null;
    let stringArrayFunctionName = ''; let decoderFound = false;

    // isDecoderAlias function moved to the outer scope to be accessible by all passes
    function isDecoderAlias(calleePath, decoderName) {
        if (!calleePath || !calleePath.isIdentifier()) return false;
        if (calleePath.node.name === decoderName) return true;
        const binding = calleePath.scope.getBinding(calleePath.node.name);
        if (binding && binding.constant && binding.path.isVariableDeclarator()) {
            const initPath = binding.path.get('init');
            if (!initPath.node) return false;
            return isDecoderAlias(initPath, decoderName);
        }
        return false;
    }

    console.log('Starting deobfuscation passes...');

    while (changed && iterations < maxIterations) {
      const before = generator(ast).code;
      if (!decoderFound) {
         traverse(ast, { FunctionDeclaration(path) {
            const bodyPaths = path.get('body').get('body'); if (bodyPaths.length !== 3) return;
            const [varDeclPath, exprStmtPath, retStmtPath] = bodyPaths;
            const varDeclNode = varDeclPath.node, exprStmtNode = exprStmtPath.node, retStmtNode = retStmtPath.node;
            if (!t.isVariableDeclaration(varDeclNode) || !varDeclNode.declarations[0] || !t.isArrayExpression(varDeclNode.declarations[0].init) || !varDeclNode.declarations[0].init.elements.every((e) => t.isStringLiteral(e))) return;
            if (!t.isExpressionStatement(exprStmtNode) || !t.isAssignmentExpression(exprStmtNode.expression) || !t.isIdentifier(exprStmtNode.expression.left, { name: path.node.id.name, }) || !t.isFunctionExpression(exprStmtNode.expression.right)) return;
            if (!t.isReturnStatement(retStmtNode)) return;
            stringArray = varDeclNode.declarations[0].init.elements.map((e) => e.value); stringArrayFunctionName = path.node.id.name; console.log(`Found string array loader: ${stringArrayFunctionName} (length: ${stringArray.length})`); path.stop();
          }});
         if (stringArrayFunctionName) { traverse(ast, { FunctionDeclaration(path) {
            if (path.node.id.name === stringArrayFunctionName) return; const bodyPaths = path.get('body').get('body'); if (bodyPaths.length !== 2) return; const [varDeclPath, returnStmtPath] = bodyPaths;
            if (!varDeclPath.isVariableDeclaration() || !varDeclPath.get('declarations.0.init').isCallExpression() || !varDeclPath.get('declarations.0.init.callee').isIdentifier({ name: stringArrayFunctionName })) return;
            if (!returnStmtPath.isReturnStatement()) return; const returnArg = returnStmtPath.get('argument'); if (!returnArg.isSequenceExpression()) return; const expressions = returnArg.get('expressions'); const firstExpr = expressions[0]; let innerFuncPath = null;
            if (firstExpr && firstExpr.isAssignmentExpression({ operator: '=' }) && t.isIdentifier(firstExpr.node.left, { name: path.node.id.name }) && t.isFunctionExpression(firstExpr.node.right)) { innerFuncPath = firstExpr.get('right'); } else return;
            if (innerFuncPath) { decoderFunctionName = path.node.id.name; innerFuncPath.traverse({ AssignmentExpression(assignPath) { const { left, right } = assignPath.node; if (t.isIdentifier(left) && t.isBinaryExpression(right, { operator: '-' }) && t.isIdentifier(right.left, { name: left.name }) && t.isNumericLiteral(right.right)) { offset = right.right.value; console.log(`Found decoder: ${decoderFunctionName}, Offset: ${offset}`); path.stop(); } } }); }
         }}); }
         if (decoderFunctionName && offset !== null) { decoderFound = true; }
      }
      
      if (decoderFound) { traverse(ast, { CallExpression(path) { const calleePath = path.get('callee'); if (isDecoderAlias(calleePath, decoderFunctionName)) { const argumentPath = path.get('arguments.0'); if (argumentPath) { const { confident, value } = argumentPath.evaluate(); if (confident && typeof value === 'number') { const index = value - offset; if (index >= 0 && index < stringArray.length && stringArray[index] !== undefined) { path.replaceWith(t.stringLiteral(stringArray[index])); } } } } } }); }
      
      traverse(ast, { 'CallExpression|BinaryExpression|MemberExpression|VariableDeclarator'(path) { if (path.isVariableDeclarator()) { const initPath = path.get('init'); if (!initPath.node) return; const { confident, value } = initPath.evaluate(); if (confident) { if (typeof value === 'number') initPath.replaceWith(t.numericLiteral(value)); else if (typeof value === 'string') initPath.replaceWith(t.stringLiteral(value)); else if (typeof value === 'boolean') initPath.replaceWith(t.booleanLiteral(value)); } return; } if (t.isCallExpression(path.node) && isDecoderAlias(path.get('callee'), decoderFunctionName)) return; const { confident, value } = path.evaluate(); if (confident) { if (typeof value === 'number') path.replaceWith(t.numericLiteral(value)); else if (typeof value === 'string') path.replaceWith(t.stringLiteral(value)); else if (typeof value === 'boolean') path.replaceWith(t.booleanLiteral(value)); } } });
      
      traverse(ast, { VariableDeclarator(path) { const { id, init } = path.node; if (t.isLiteral(init)) { const binding = path.scope.getBinding(id.name); if (binding && binding.constant && binding.referenced) { binding.referencePaths.forEach((refPath) => { refPath.replaceWith(init); }); } } } });
      
      traverse(ast, { MemberExpression(path) { if (path.node.computed && t.isStringLiteral(path.node.property)) { if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(path.node.property.value)) { path.node.computed = false; path.node.property = t.identifier(path.node.property.value); } } } });

      const after = generator(ast).code; changed = before !== after; iterations++; console.log(`Pass ${iterations} completed. Changes detected: ${changed}`);
    }
    
    console.log('Performing final dead code removal pass...'); traverse(ast, { 'VariableDeclarator|FunctionDeclaration'(path) { const { id } = path.node; if (id && id.name) { const binding = path.scope.getBinding(id.name); if (binding && !binding.referenced) { if (path.parentPath.isVariableDeclaration() && path.parentPath.node.declarations.length === 1) path.parentPath.remove(); else if (!path.parentPath.isVariableDeclaration() && path.isFunctionDeclaration()) path.remove(); else if (path.isVariableDeclarator() && path.parentPath.isVariableDeclaration()) path.remove(); } } }, ExpressionStatement(path) { if (t.isCallExpression(path.node.expression)) { const callee = path.node.expression.callee; if (t.isFunctionExpression(callee) && callee.body.body.length > 0) { const firstStatement = callee.body.body[0]; if (t.isWhileStatement(firstStatement)) path.remove(); } } } });

    const deobfuscatedCode = generator(ast, { comments: false }).code;
    return prettier.format(deobfuscatedCode, { parser: 'babel' });
}

// --- 3. Main Execution ---
(async () => {
  const inputFileContainerPath = process.argv[2]; 
  if (!inputFileContainerPath) {
    console.error('Error: Please provide the path to the HTML file inside the container (e.g., /data/your_file.html).');
    console.error('Usage: docker-compose run --rm deobfuscator /data/<your_file.html>');
    process.exit(1);
  }

  const viewerHostPath = process.env.VIEWER_HOST_PATH;
  if (!viewerHostPath) {
      console.error('Error: VIEWER_HOST_PATH environment variable not set.');
      console.error('Ensure it is defined in your docker-compose.yml file.');
      process.exit(1);
  }
   if (!viewerHostPath.startsWith('/') && !viewerHostPath.match(/^[a-zA-Z]:\\/)) { 
       console.warn(`Warning: VIEWER_HOST_PATH ("${viewerHostPath}") might not be an absolute path. Ensure it's correct on your host.`);
   }


  try {
    const htmlContent = fs.readFileSync(inputFileContainerPath, 'utf-8');
    const finalCode = await deobfuscate(htmlContent);

    if (finalCode === null || typeof finalCode !== 'string') {
        console.error("Deobfuscation did not return valid code. Exiting.");
        process.exit(1);
    }

    console.log('\n--- Deobfuscated Code Generated ---'); 

    const encodedCode = encodeURIComponent(finalCode);

    const fileUrl = `file://${viewerHostPath}#${encodedCode}`;

    console.log('\n--- URL for AST Viewer ---');
    console.log(fileUrl);
    console.log('--------------------------');
    console.log('Copy the URL above and paste it into your host machine\'s browser.');
  } catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`Error: Input file not found inside the container at ${inputFileContainerPath}`);
        console.error('Ensure the file exists in the directory mounted to /data and you are using the /data/... path.');
    } else {
        console.error(`An unexpected error occurred: ${error.message}`);
        console.error(error.stack);
    }
    process.exit(1);
  }
})();