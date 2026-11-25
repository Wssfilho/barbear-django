from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from Usuario.auth import (
    BarbeiroTokenObtainPairView, ClienteTokenObtainPairView, PerfilTokenObtainPairView,
)
from Usuario.urls import Urouter
from service.urls import Srouter
from barbshop.urls import Brouter
from scheduling.urls import Qrouter
from .health import health

api_patterns = [
    path('admin/', admin.site.urls),
    path('api/token/', PerfilTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/cliente/', ClienteTokenObtainPairView.as_view(), name='token_obtain_cliente'),
    path('api/token/barbeiro/', BarbeiroTokenObtainPairView.as_view(), name='token_obtain_barbeiro'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include('assistant.urls')),
    path('', include(Urouter.urls)),
    path('', include(Brouter.urls)),
    path('', include(Srouter.urls)),
    path('', include(Qrouter.urls)),
]

urlpatterns = [
    path('health/', health, name='health'),
    path('django/', include((api_patterns, 'api'), namespace='django-api')),
    *api_patterns,
]
