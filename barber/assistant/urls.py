from django.urls import path
from .views import PlansView, MyPlansView, PlanDetailView, AssistantStatusView, RecommendView

urlpatterns = [
    path('plans/', PlansView.as_view(), name='plans'),
    path('plans/mine/', MyPlansView.as_view(), name='plans-mine'),
    path('plans/<int:pk>/', PlanDetailView.as_view(), name='plan-detail'),
    path('assistant/status/', AssistantStatusView.as_view(), name='assistant-status'),
    path('assistant/recommend/', RecommendView.as_view(), name='assistant-recommend'),
]
