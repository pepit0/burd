from pydantic import BaseModel


class Prediction(BaseModel):
    species: str
    scientific_name: str | None = None
    confidence: float  # 0..1


class NativeLogit(BaseModel):
    species_code: str
    logit: float


class ValidationCheck(BaseModel):
    id: str
    passed: bool
    score: float
    message: str


class ValidationResult(BaseModel):
    enabled: bool
    passed: bool
    checks: list[ValidationCheck] = []


class IdentifyResponse(BaseModel):
    predictions: list[Prediction]
    heard_species: list[Prediction] = []
    count: int = 1
    model: str
    mock: bool
    validation: ValidationResult | None = None
    regional_context_applied: bool = False
    native_logits: list[NativeLogit] = []


class ModelStatus(BaseModel):
    loaded: bool
    mock: bool
    weights: str | None = None
    code_license: str = "Apache-2.0"
    weights_license: str | None = None
    commercial_status: str | None = None
    license_note: str | None = None
    num_classes: int | None = None
    load_error: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    mock: bool
    image: ModelStatus
    audio: ModelStatus
