plugins {
    java
}

group = "com.rsvp"
version = "1.0.0"

java {
    toolchain { languageVersion.set(JavaLanguageVersion.of(21)) }
}

repositories { mavenCentral() }

tasks.test { useJUnitPlatform() }

