"""
OpenTelemetry Telemetry Module

Provides observability for the RFP application:
- Distributed tracing for requests and LLM calls
- Metrics for latency, token usage, and error rates
- Easy integration with observability backends (Jaeger, Prometheus, etc.)
"""
import os
import logging
from functools import wraps
from typing import Callable, Optional, Dict, Any
from contextlib import contextmanager
import time

logger = logging.getLogger(__name__)

# Telemetry configuration
TELEMETRY_ENABLED = os.environ.get('OTEL_ENABLED', 'false').lower() == 'true'
OTEL_EXPORTER_TYPE = os.environ.get('OTEL_EXPORTER_TYPE', 'console')  # console, otlp, prometheus
OTEL_SERVICE_NAME = os.environ.get('OTEL_SERVICE_NAME', 'rfp-backend')
OTEL_EXPORTER_ENDPOINT = os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317')

# Global tracer and meter (initialized lazily)
_tracer = None
_meter = None
_initialized = False


def init_telemetry(app=None):
    """
    Initialize OpenTelemetry instrumentation.
    
    Call this during Flask app initialization.
    """
    global _tracer, _meter, _initialized
    
    if _initialized:
        return
    
    if not TELEMETRY_ENABLED:
        logger.info("Telemetry disabled (set OTEL_ENABLED=true to enable)")
        _initialized = True
        return
    
    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        
        # Create resource with service name
        resource = Resource(attributes={
            SERVICE_NAME: OTEL_SERVICE_NAME
        })
        
        # Initialize tracer provider
        tracer_provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(tracer_provider)
        
        # Initialize meter provider
        meter_provider = MeterProvider(resource=resource)
        metrics.set_meter_provider(meter_provider)
        
        # Configure exporters based on type
        if OTEL_EXPORTER_TYPE == 'otlp':
            _configure_otlp_exporter(tracer_provider)
        elif OTEL_EXPORTER_TYPE == 'console':
            _configure_console_exporter(tracer_provider)
        
        # Get tracer and meter
        _tracer = trace.get_tracer(__name__)
        _meter = metrics.get_meter(__name__)
        
        # Instrument Flask if app provided
        if app:
            _instrument_flask(app)
        
        logger.info(f"Telemetry initialized: service={OTEL_SERVICE_NAME}, exporter={OTEL_EXPORTER_TYPE}")
        _initialized = True
        
    except ImportError as e:
        logger.warning(f"OpenTelemetry not installed: {e}")
        _initialized = True
    except Exception as e:
        logger.error(f"Failed to initialize telemetry: {e}")
        _initialized = True


def _configure_otlp_exporter(tracer_provider):
    """Configure OTLP exporter for production use."""
    try:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        
        otlp_exporter = OTLPSpanExporter(endpoint=OTEL_EXPORTER_ENDPOINT)
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        logger.info(f"OTLP exporter configured: {OTEL_EXPORTER_ENDPOINT}")
    except Exception as e:
        logger.warning(f"Could not configure OTLP exporter: {e}")


def _configure_console_exporter(tracer_provider):
    """Configure console exporter for development."""
    try:
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter
        
        console_exporter = ConsoleSpanExporter()
        tracer_provider.add_span_processor(SimpleSpanProcessor(console_exporter))
        logger.info("Console exporter configured")
    except Exception as e:
        logger.warning(f"Could not configure console exporter: {e}")


def _instrument_flask(app):
    """Instrument Flask application with OpenTelemetry."""
    try:
        from opentelemetry.instrumentation.flask import FlaskInstrumentor
        FlaskInstrumentor().instrument_app(app)
        logger.info("Flask instrumented with OpenTelemetry")
    except ImportError:
        logger.warning("Flask instrumentation not available")
    except Exception as e:
        logger.warning(f"Could not instrument Flask: {e}")


def get_tracer():
    """Get the global tracer instance."""
    global _tracer
    if _tracer is None and TELEMETRY_ENABLED:
        init_telemetry()
    return _tracer


def get_meter():
    """Get the global meter instance."""
    global _meter
    if _meter is None and TELEMETRY_ENABLED:
        init_telemetry()
    return _meter


# ============================================================================
# LLM Call Instrumentation
# ============================================================================

# Metrics counters
_llm_call_counter = None
_llm_token_counter = None
_llm_latency_histogram = None


def _init_llm_metrics():
    """Initialize LLM-specific metrics."""
    global _llm_call_counter, _llm_token_counter, _llm_latency_histogram
    
    meter = get_meter()
    if meter is None:
        return
    
    if _llm_call_counter is None:
        _llm_call_counter = meter.create_counter(
            name="llm_calls_total",
            description="Total number of LLM API calls",
            unit="1"
        )
    
    if _llm_token_counter is None:
        _llm_token_counter = meter.create_counter(
            name="llm_tokens_total",
            description="Total tokens used in LLM calls",
            unit="1"
        )
    
    if _llm_latency_histogram is None:
        _llm_latency_histogram = meter.create_histogram(
            name="llm_call_duration_seconds",
            description="Duration of LLM API calls",
            unit="s"
        )


@contextmanager
def trace_llm_call(
    provider: str,
    model: str,
    agent_type: str = "unknown",
    org_id: int = None
):
    """
    Context manager for tracing LLM calls.
    
    Usage:
        with trace_llm_call("openai", "gpt-4", "answer_generation", org_id=1):
            response = provider.generate_content(prompt)
    """
    tracer = get_tracer()
    start_time = time.time()
    
    attributes = {
        "llm.provider": provider,
        "llm.model": model,
        "agent.type": agent_type,
    }
    if org_id:
        attributes["org.id"] = str(org_id)
    
    if tracer:
        with tracer.start_as_current_span("llm_call", attributes=attributes) as span:
            try:
                yield span
                duration = time.time() - start_time
                span.set_attribute("llm.duration_ms", int(duration * 1000))
                _record_llm_metrics(provider, model, agent_type, duration, success=True)
            except Exception as e:
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                _record_llm_metrics(provider, model, agent_type, time.time() - start_time, success=False)
                raise
    else:
        # No-op context when telemetry disabled
        try:
            yield None
        except Exception:
            raise


def _record_llm_metrics(provider: str, model: str, agent_type: str, duration: float, success: bool):
    """Record LLM call metrics."""
    _init_llm_metrics()
    
    labels = {
        "provider": provider,
        "model": model,
        "agent_type": agent_type,
        "success": str(success).lower()
    }
    
    if _llm_call_counter:
        _llm_call_counter.add(1, labels)
    
    if _llm_latency_histogram:
        _llm_latency_histogram.record(duration, labels)


def record_token_usage(provider: str, model: str, prompt_tokens: int, completion_tokens: int):
    """Record token usage for an LLM call."""
    _init_llm_metrics()
    
    if _llm_token_counter:
        _llm_token_counter.add(prompt_tokens, {
            "provider": provider,
            "model": model,
            "type": "prompt"
        })
        _llm_token_counter.add(completion_tokens, {
            "provider": provider,
            "model": model,
            "type": "completion"
        })


# ============================================================================
# Decorator for Easy Instrumentation
# ============================================================================

def traced(name: str = None, attributes: Dict[str, Any] = None):
    """
    Decorator to trace a function.
    
    Usage:
        @traced("process_document")
        def process_document(doc_id):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            span_name = name or func.__name__
            
            if tracer:
                with tracer.start_as_current_span(span_name) as span:
                    if attributes:
                        for key, value in attributes.items():
                            span.set_attribute(key, value)
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================================================
# Health Check with Telemetry Status
# ============================================================================

def get_telemetry_status() -> Dict[str, Any]:
    """Get current telemetry status for health checks."""
    return {
        "enabled": TELEMETRY_ENABLED,
        "initialized": _initialized,
        "service_name": OTEL_SERVICE_NAME,
        "exporter_type": OTEL_EXPORTER_TYPE,
        "exporter_endpoint": OTEL_EXPORTER_ENDPOINT if OTEL_EXPORTER_TYPE == 'otlp' else None
    }
