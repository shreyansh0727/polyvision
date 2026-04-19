if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/shrey/.gradle/caches/8.8/transforms/fa56ebe2543f3faa4e9481d92bc5d16f/transformed/hermes-android-0.76.7-debug/prefab/modules/libhermes/libs/android.x86_64/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/shrey/.gradle/caches/8.8/transforms/fa56ebe2543f3faa4e9481d92bc5d16f/transformed/hermes-android-0.76.7-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

