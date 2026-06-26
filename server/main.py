from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas import HealthResponse, IdentifyResponse, ModelStatus
from inference.image import ImageClassifier
from inference.audio import AudioClassifier
from inference.validation import validate_image

image_classifier = ImageClassifier()
audio_classifier = AudioClassifier()


@asynccontextmanager
async def lifespan(app: FastAPI):
    image_classifier.load()
    audio_classifier.load()
    yield


app = FastAPI(title="Burd Inference API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 15 * 1024 * 1024  # 15 MB


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        mock=settings.inference_mock,
        image=ModelStatus(**image_classifier.status()),
        audio=ModelStatus(**audio_classifier.status()),
    )


@app.post("/identify/image", response_model=IdentifyResponse)
async def identify_image(image: UploadFile = File(...)) -> IdentifyResponse:
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")
    try:
        preds, count = image_classifier.predict(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    validation = validate_image(data, preds)
    if validation.enabled and not validation.passed:
        failed = [c.message for c in validation.checks if not c.passed]
        raise HTTPException(
            status_code=422,
            detail={
                "message": failed[0] if failed else "Photo did not pass validation.",
                "validation": validation.model_dump(),
            },
        )
    return IdentifyResponse(
        predictions=preds,
        count=count,
        model=image_classifier.model_name,
        mock=image_classifier.mock,
        validation=validation,
    )


@app.post("/identify/audio", response_model=IdentifyResponse)
async def identify_audio(audio: UploadFile = File(...)) -> IdentifyResponse:
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large")
    try:
        preds = audio_classifier.predict(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return IdentifyResponse(
        predictions=preds,
        model=audio_classifier.model_name,
        mock=audio_classifier.mock,
    )
