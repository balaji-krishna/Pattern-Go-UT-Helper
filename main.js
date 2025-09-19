let BACKEND = "http://localhost:8000"; // Change this to your deployed backend URL

// DOM Elements
const patternNameEl = document.getElementById("pattern-name");
const patternDescriptionEl = document.getElementById("pattern-description");
const patternContentEl = document.getElementById("pattern-content");
const uploadPatternBtn = document.getElementById("upload-pattern-btn");

const fileNameEl = document.getElementById("file-name");
const packageNameEl = document.getElementById("package-name");
const sourceCodeEl = document.getElementById("source-code");
const uploadSourceBtn = document.getElementById("upload-source-btn");

const additionalContextEl = document.getElementById("additional-context");
const generateTestsBtn = document.getElementById("generate-tests-btn");
const statusMessageEl = document.getElementById("status-message");
const outputEl = document.getElementById("output");

// State management
let uploadedPattern = null;
let uploadedSourceCode = null;

// Event Listeners
uploadPatternBtn.addEventListener("click", async () => {
  await uploadPattern();
});

uploadSourceBtn.addEventListener("click", async () => {
  await uploadSourceCode();
});

generateTestsBtn.addEventListener("click", async () => {
  await generateUnitTests();
});

// Update button state when both uploads are complete
function updateGenerateButtonState() {
  if (uploadedPattern && uploadedSourceCode) {
    generateTestsBtn.disabled = false;
    generateTestsBtn.textContent = "Generate Unit Tests";
  } else {
    generateTestsBtn.disabled = true;
    generateTestsBtn.textContent = "Complete uploads to generate tests";
  }
}

// Upload Pattern Function
async function uploadPattern() {
  const patternName = patternNameEl.value.trim();
  const patternContent = patternContentEl.value.trim();
  const description = patternDescriptionEl.value.trim();

  if (!patternName || !patternContent) {
    showStatus("Please provide both pattern name and content.", "error");
    return;
  }

  showStatus("Uploading pattern...", "info");
  uploadPatternBtn.disabled = true;

  try {
    const response = await fetch(`${BACKEND}/upload-pattern`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern_name: patternName,
        pattern_content: patternContent,
        description: description || null
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showStatus(`Error uploading pattern: ${data.detail || JSON.stringify(data)}`, "error");
      return;
    }

    uploadedPattern = {
      pattern_name: patternName,
      pattern_content: patternContent,
      description: description
    };

    showStatus(`✅ Pattern "${patternName}" uploaded successfully!`, "success");
    updateGenerateButtonState();

  } catch (error) {
    showStatus(`Network error: ${error.message}`, "error");
  } finally {
    uploadPatternBtn.disabled = false;
  }
}

// Upload Source Code Function
async function uploadSourceCode() {
  const fileName = fileNameEl.value.trim();
  const sourceCode = sourceCodeEl.value.trim();
  const packageName = packageNameEl.value.trim();

  if (!fileName || !sourceCode) {
    showStatus("Please provide both file name and source code.", "error");
    return;
  }

  if (!fileName.endsWith('.go')) {
    showStatus("File name must end with .go extension.", "error");
    return;
  }

  showStatus("Uploading source code...", "info");
  uploadSourceBtn.disabled = true;

  try {
    const response = await fetch(`${BACKEND}/upload-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: fileName,
        source_code: sourceCode,
        package_name: packageName || null
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showStatus(`Error uploading source code: ${data.detail || JSON.stringify(data)}`, "error");
      return;
    }

    uploadedSourceCode = {
      file_name: fileName,
      source_code: sourceCode,
      package_name: packageName
    };

    showStatus(`✅ Source file "${fileName}" uploaded successfully!`, "success");
    updateGenerateButtonState();

  } catch (error) {
    showStatus(`Network error: ${error.message}`, "error");
  } finally {
    uploadSourceBtn.disabled = false;
  }
}

// Generate Unit Tests Function
async function generateUnitTests() {
  if (!uploadedPattern || !uploadedSourceCode) {
    showStatus("Please upload both pattern and source code first.", "error");
    return;
  }

  showStatus("🤖 Generating unit tests using AI...", "info");
  generateTestsBtn.disabled = true;
  generateTestsBtn.textContent = "Generating...";
  
  setOutput("Generating unit tests, please wait...");

  const additionalContext = additionalContextEl.value.trim();

  try {
    const response = await fetch(`${BACKEND}/generate-ut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern_content: uploadedPattern.pattern_content,
        source_code: uploadedSourceCode.source_code,
        file_name: uploadedSourceCode.file_name,
        pattern_name: uploadedPattern.pattern_name,
        additional_context: additionalContext || null
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showStatus(`Error generating unit tests: ${data.detail || JSON.stringify(data)}`, "error");
      setOutput("Failed to generate unit tests. Please check the error message above.");
      return;
    }

    showStatus(`✅ Unit tests generated successfully using pattern "${data.pattern_used}"!`, "success");
    setOutput(data.unit_tests);

  } catch (error) {
    showStatus(`Network error: ${error.message}`, "error");
    setOutput("Network error occurred while generating unit tests.");
  } finally {
    generateTestsBtn.disabled = false;
    generateTestsBtn.textContent = "Generate Unit Tests";
  }
}

// Utility Functions
function showStatus(message, type) {
  statusMessageEl.innerHTML = `<div class="status ${type}">${message}</div>`;
  
  // Auto-hide success messages after 5 seconds
  if (type === "success") {
    setTimeout(() => {
      statusMessageEl.innerHTML = "";
    }, 5000);
  }
}

function setOutput(content) {
  outputEl.textContent = content;
}

// Initialize
updateGenerateButtonState();
