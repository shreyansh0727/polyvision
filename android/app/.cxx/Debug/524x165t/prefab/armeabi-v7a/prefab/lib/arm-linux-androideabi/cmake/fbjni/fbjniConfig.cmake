if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "C:/Users/shrey/.gradle/caches/8.8/transforms/8671c8a2f0f26b0aeaf994174d4b76a2/transformed/fbjni-0.6.0/prefab/modules/fbjni/libs/android.armeabi-v7a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/shrey/.gradle/caches/8.8/transforms/8671c8a2f0f26b0aeaf994174d4b76a2/transformed/fbjni-0.6.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

