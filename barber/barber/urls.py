from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from Usuario.urls import Urouter
from service.urls import Srouter
from barbshop.urls import Brouter

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(Urouter.urls)),
    path('', include(Brouter.urls)),
    path('', include(Srouter.urls)),
]
