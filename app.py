import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY environment variable")

app = FastAPI(
    title="Pattern-Based GoLang UT Helper",
    description="Intelligent AI agent for standardized unit test case generation for Go projects",
    version="1.0.0"
)

# CORS: in production, set your exact GitHub Pages origin(s) instead of "*"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

class PatternUpload(BaseModel):
    pattern_content: str
    pattern_name: str
    description: Optional[str] = None

class SourceCodeUpload(BaseModel):
    source_code: str
    file_name: str
    package_name: Optional[str] = None

class UTGenerationRequest(BaseModel):
    pattern_content: str
    source_code: str
    file_name: str
    pattern_name: str
    additional_context: Optional[str] = None

class UTGenerationResponse(BaseModel):
    unit_tests: str
    pattern_used: str
    file_analyzed: str

@app.get("/")
def root():
    return {
        "ok": True, 
        "service": "golang-ut-helper", 
        "model": GEMINI_MODEL,
        "description": "Pattern-Based GoLang Unit Test Generator",
        "version": "1.0.0"
    }

@app.post("/upload-pattern")
async def upload_pattern(payload: PatternUpload):
    """Upload a UT pattern file that defines the testing methodology"""
    pattern_content = payload.pattern_content.strip()
    pattern_name = payload.pattern_name.strip()
    
    if not pattern_content:
        raise HTTPException(status_code=400, detail="Pattern content is required")
    if not pattern_name:
        raise HTTPException(status_code=400, detail="Pattern name is required")
    
    # In a real implementation, you'd store this pattern for later use
    return {
        "status": "success",
        "message": f"Pattern '{pattern_name}' uploaded successfully",
        "pattern_name": pattern_name,
        "description": payload.description
    }

@app.post("/upload-source")
async def upload_source(payload: SourceCodeUpload):
    """Upload Go source code for analysis"""
    source_code = payload.source_code.strip()
    file_name = payload.file_name.strip()
    
    if not source_code:
        raise HTTPException(status_code=400, detail="Source code is required")
    if not file_name:
        raise HTTPException(status_code=400, detail="File name is required")
    
    # Basic validation for Go files
    if not file_name.endswith('.go'):
        raise HTTPException(status_code=400, detail="File must be a Go source file (.go)")
    
    return {
        "status": "success",
        "message": f"Source file '{file_name}' uploaded successfully",
        "file_name": file_name,
        "package_name": payload.package_name
    }

@app.post("/generate-ut", response_model=UTGenerationResponse)
async def generate_unit_tests(payload: UTGenerationRequest):
    """Generate unit tests based on pattern and source code using Gemini AI"""
    pattern_content = payload.pattern_content.strip()
    source_code = payload.source_code.strip()
    file_name = payload.file_name.strip()
    pattern_name = payload.pattern_name.strip()
    
    if not all([pattern_content, source_code, file_name, pattern_name]):
        raise HTTPException(status_code=400, detail="All fields (pattern_content, source_code, file_name, pattern_name) are required")
    
    # Construct the prompt for Gemini
    prompt = f"""
You are an expert Go developer tasked with generating unit tests based on a specific pattern.

PATTERN DEFINITION:
Pattern Name: {pattern_name}
Pattern Content:
{pattern_content}

SOURCE CODE TO TEST:
File Name: {file_name}
{source_code}

ADDITIONAL CONTEXT:
{payload.additional_context or "None provided"}

INSTRUCTIONS:
1. Analyze the provided pattern to understand the testing methodology
2. Study the source code structure, functions, and interfaces
3. Generate comprehensive unit tests following the pattern's style and conventions
4. Include test cases for:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Mock usage (if shown in pattern)
5. Ensure tests are idiomatic Go and follow the pattern's approach
6. Provide ONLY the generated test code, no explanations

Generate the unit tests:
"""

    body = {"contents": [{"parts": [{"text": prompt}]}]}

    timeout = httpx.Timeout(60.0, read=60.0)  # Increased timeout for complex generation
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(GEMINI_URL, json=body, headers={"Content-Type": "application/json"})
        data = r.json()
        if r.status_code != 200:
            msg = (data.get("error") or {}).get("message") or "Upstream error"
            raise HTTPException(status_code=r.status_code, detail=msg)

    try:
        unit_tests = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        raise HTTPException(status_code=502, detail=f"Unexpected API response: {json.dumps(data)[:800]}")
    
    return {
        "unit_tests": unit_tests,
        "pattern_used": pattern_name,
        "file_analyzed": file_name
    }

if __name__ == "__main__":
    # for local dev: uvicorn app:app --reload
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
